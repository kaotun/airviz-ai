import os
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("import_csv")

def main():
    csv_path = "/data/cleaned/vietnam_air_quality_dataset_cleaned.csv"
    if not os.path.exists(csv_path):
        log.error("Không tìm thấy file %s. Đảm bảo bạn đã map thư mục /data trong docker-compose.yml", csv_path)
        return

    log.info("Đang đọc dữ liệu từ file CSV...")
    df = pd.read_csv(csv_path)
    
    # Đổi tên cột trực tiếp theo đúng thứ tự để tránh lỗi font chữ/encoding của (µg/m3)
    df.columns = [
        "time", "province_id", "Province", "Region", "european_aqi",
        "pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide", 
        "sulphur_dioxide", "ozone", "dust"
    ]
    df["time"] = pd.to_datetime(df["time"])
    
    log.info("Kết nối tới Database TimescaleDB...")
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "timescaledb"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        dbname=os.getenv("POSTGRES_DB", "airviz"),
    )
    
    # Insert provinces first to avoid foreign key violations
    import json
    provinces_file = "/data/meta/provinces.json"
    if os.path.exists(provinces_file):
        with open(provinces_file, "r", encoding="utf-8") as f:
            provinces_data = json.load(f)
        
        with conn.cursor() as cur:
            for p in provinces_data:
                # Tạo slug đơn giản giống hàm crawl_openmeteo
                import re
                import unicodedata
                # Xóa dấu tiếng Việt
                s = unicodedata.normalize('NFKD', p["Province"]).encode('ASCII', 'ignore').decode('utf-8')
                slug = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
                
                cur.execute(
                    """
                    INSERT INTO provinces (id, slug, name, latitude, longitude)
                    VALUES (%(id)s, %(slug)s, %(name)s, %(latitude)s, %(longitude)s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    {
                        "id": int(p["Code"]),
                        "slug": slug,
                        "name": p["Province"],
                        "latitude": p["Latitude"],
                        "longitude": p["Longitude"]
                    }
                )
        conn.commit()
        log.info("Đã chèn/kiểm tra 63 tỉnh thành vào bảng provinces.")
    
    # Prepare rows for bulk insert
    rows = []
    for _, row in df.iterrows():
        rows.append((
            row["time"].to_pydatetime(),
            int(row["province_id"]),
            float(row["pm2_5"]) if pd.notna(row["pm2_5"]) else None,
            float(row["pm10"]) if pd.notna(row["pm10"]) else None,
            float(row["carbon_monoxide"]) if pd.notna(row["carbon_monoxide"]) else None,
            float(row["nitrogen_dioxide"]) if pd.notna(row["nitrogen_dioxide"]) else None,
            float(row["sulphur_dioxide"]) if pd.notna(row["sulphur_dioxide"]) else None,
            float(row["ozone"]) if pd.notna(row["ozone"]) else None,
            float(row["dust"]) if pd.notna(row["dust"]) else None,
            float(row["european_aqi"]) if pd.notna(row["european_aqi"]) else None,
        ))
    
    log.info("Đang nạp %d dòng dữ liệu vào Database (Quá trình này có thể mất vài chục giây)...", len(rows))
    
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO env_readings (
                time, province_id,
                pm2_5, pm10, carbon_monoxide, nitrogen_dioxide,
                sulphur_dioxide, ozone, dust, european_aqi
            ) VALUES %s
            ON CONFLICT (time, province_id) DO UPDATE SET
                pm2_5            = EXCLUDED.pm2_5,
                pm10             = EXCLUDED.pm10,
                carbon_monoxide  = EXCLUDED.carbon_monoxide,
                nitrogen_dioxide = EXCLUDED.nitrogen_dioxide,
                sulphur_dioxide  = EXCLUDED.sulphur_dioxide,
                ozone            = EXCLUDED.ozone,
                dust             = EXCLUDED.dust,
                european_aqi     = EXCLUDED.european_aqi
            """,
            rows,
            page_size=10000,
        )
    conn.commit()
    conn.close()
    
    log.info("🎉 Tuyệt vời! Đã nạp thành công toàn bộ dữ liệu từ CSV vào Database!")

if __name__ == "__main__":
    main()
