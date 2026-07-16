import os
import json
import asyncio
import asyncpg
import pandas as pd
from datetime import datetime
import re

DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5433")
DB_USER = os.getenv("POSTGRES_USER", "airviz")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "airviz_pass")
DB_NAME = os.getenv("POSTGRES_DB", "airviz_db")

def slugify(text):
    text = text.lower()
    text = re.sub(r'[áàảãạâấầẩẫậăắằẳẵặ]', 'a', text)
    text = re.sub(r'[éèẻẽẹêếềểễệ]', 'e', text)
    text = re.sub(r'[íìỉĩị]', 'i', text)
    text = re.sub(r'[óòỏõọôốồổỗộơớờởỡợ]', 'o', text)
    text = re.sub(r'[úùủũụưứừửữự]', 'u', text)
    text = re.sub(r'[ýỳỷỹỵ]', 'y', text)
    text = re.sub(r'[đ]', 'd', text)
    text = re.sub(r'[^a-z0-9\-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

async def main():
    print("Connecting to DB...")
    # Attempt connection with retries
    conn = None
    for _ in range(5):
        try:
            conn = await asyncpg.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASS,
                database=DB_NAME
            )
            break
        except Exception as e:
            print(f"Connection failed, retrying... ({e})")
            await asyncio.sleep(2)
            
    if not conn:
        print("Could not connect to database")
        return

    # 1. Insert Provinces
    print("Loading provinces...")
    prov_path = '/data/meta/provinces.json' if os.path.exists('/data/meta/provinces.json') else '../data/meta/provinces.json'
    with open(prov_path, 'r', encoding='utf-8') as f:
        provinces = json.load(f)
    
    prov_records = []
    for p in provinces:
        prov_records.append((
            int(p['Code']),
            slugify(p['Province']),
            p['Province'],
            float(p['Latitude']),
            float(p['Longitude'])
        ))
    
    await conn.executemany('''
        INSERT INTO provinces (id, slug, name, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude
    ''', prov_records)
    print(f"Inserted/Updated {len(prov_records)} provinces.")

    # 2. Insert Readings
    csv_path = '/data/cleaned/vietnam_air_quality_dataset_cleaned.csv' if os.path.exists('/data/cleaned/vietnam_air_quality_dataset_cleaned.csv') else '../data/cleaned/vietnam_air_quality_dataset_cleaned.csv'
    print(f"Loading readings from {csv_path}...")
    
    # We will use copy_records_to_table for bulk insert
    # Read chunk by chunk to avoid memory issues and to drop duplicates
    chunksize = 100000
    total_inserted = 0
    
    for i, df in enumerate(pd.read_csv(csv_path, chunksize=chunksize)):
        print(f"Processing chunk {i+1}...")
        
        # Convert timestamp to UTC (assuming the CSV timestamp is local +07:00)
        df['Timestamp'] = pd.to_datetime(df['Timestamp']).dt.tz_localize('Asia/Ho_Chi_Minh')
        
        # Drop duplicates on primary key
        df = df.drop_duplicates(subset=['Timestamp', 'Code'])
        
        # Prepare records for copy
        records = []
        for row in df.itertuples(index=False):
            # Timestamp,Code,Province,Region,AQI,PM2.5,PM10,CO,NO2,SO2,O3,Dust,Year,Month,Day,Hour,DayOfWeek,AQI_Level
            # row._6 is PM2.5, wait, better use getattr
            records.append((
                row.Timestamp,
                int(row.Code),
                float(getattr(row, 'PM2.5', getattr(row, '_6', None))) if pd.notna(getattr(row, 'PM2.5', getattr(row, '_6', None))) else None,
                float(row.PM10) if pd.notna(row.PM10) else None,
                float(row.CO) if pd.notna(row.CO) else None,
                float(row.NO2) if pd.notna(row.NO2) else None,
                float(row.SO2) if pd.notna(row.SO2) else None,
                float(row.O3) if pd.notna(row.O3) else None,
                float(row.Dust) if pd.notna(row.Dust) else None,
                float(row.AQI) if pd.notna(row.AQI) else None
            ))
            
        # Due to constraints, it's safer to use a temporary table and then INSERT ... ON CONFLICT DO NOTHING
        await conn.execute('''
            CREATE TEMP TABLE temp_readings (
                time TIMESTAMPTZ,
                province_id SMALLINT,
                pm2_5 REAL,
                pm10 REAL,
                carbon_monoxide REAL,
                nitrogen_dioxide REAL,
                sulphur_dioxide REAL,
                ozone REAL,
                dust REAL,
                european_aqi REAL
            )
        ''')
        
        await conn.copy_records_to_table(
            'temp_readings',
            records=records,
            columns=['time', 'province_id', 'pm2_5', 'pm10', 'carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'dust', 'european_aqi']
        )
        
        res = await conn.execute('''
            INSERT INTO env_readings (time, province_id, pm2_5, pm10, carbon_monoxide, nitrogen_dioxide, sulphur_dioxide, ozone, dust, european_aqi)
            SELECT time, province_id, pm2_5, pm10, carbon_monoxide, nitrogen_dioxide, sulphur_dioxide, ozone, dust, european_aqi
            FROM temp_readings
            ON CONFLICT (time, province_id) DO NOTHING
        ''')
        
        await conn.execute('DROP TABLE temp_readings')
        
        # res looks like "INSERT 0 100000"
        inserted = int(res.split()[-1])
        total_inserted += inserted
        print(f"Inserted {inserted} records from chunk {i+1}. Total so far: {total_inserted}")

    print(f"Finished inserting all chunks. Total inserted: {total_inserted}")
    
    # 3. Refresh Continuous Aggregate View
    print("Refreshing daily_aqi materialized view...")
    try:
        await conn.execute("CALL refresh_continuous_aggregate('daily_aqi', NULL, NULL);")
        print("Refreshed successfully.")
    except Exception as e:
        print(f"Could not refresh view: {e}")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
