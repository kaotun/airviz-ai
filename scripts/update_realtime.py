"""
update_realtime.py
------------------
Cập nhật dữ liệu chất lượng không khí mới nhất cho 63 tỉnh thành Việt Nam.
Script này chạy mỗi 1 giờ (qua APScheduler hoặc cron).

Khác với crawl_openmeteo.py (lấy dữ liệu lịch sử nhiều tháng),
script này chỉ lấy dữ liệu trong vòng 24 giờ gần nhất (forecast_days=1).
"""

import json
import logging
import os
import time
from datetime import date, timedelta
from pathlib import Path

import httpx
import psycopg2
from psycopg2.extras import execute_values

# Re-use các helper từ crawl_openmeteo
from crawl_openmeteo import (
    HOURLY_VARIABLES,
    MAX_RETRIES,
    REQUEST_DELAY_S,
    df_to_rows,
    get_db_connection,
    upsert_province,
    upsert_readings,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

OPENMETEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
PROVINCES_FILE = Path(__file__).parent.parent / "data" / "provinces.json"


def fetch_latest(client: httpx.Client, province: dict):
    """
    Lấy dữ liệu 2 ngày gần nhất (hôm qua + hôm nay) để đảm bảo
    không bỏ sót dữ liệu khi chạy ở ranh giới ngày.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)

    params = {
        "latitude": province["latitude"],
        "longitude": province["longitude"],
        "hourly": ",".join(HOURLY_VARIABLES),
        "start_date": yesterday.isoformat(),
        "end_date": today.isoformat(),
        "timezone": "Asia/Ho_Chi_Minh",
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.get(OPENMETEO_URL, params=params, timeout=20.0)
            response.raise_for_status()
            data = response.json()
            hourly = data.get("hourly", {})
            if not hourly or "time" not in hourly:
                return None
            import pandas as pd
            df = pd.DataFrame(hourly)
            df["time"] = pd.to_datetime(df["time"])
            df["province_id"] = province["id"]
            return df
        except Exception as e:
            log.warning("[%s] Lần %d/%d — %s", province["name"], attempt, MAX_RETRIES, str(e))
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)

    return None


def run():
    log.info("── Realtime update bắt đầu ──────────────────────────────────")
    provinces = json.loads(PROVINCES_FILE.read_text(encoding="utf-8"))
    conn = get_db_connection()

    total_upserted = 0
    with httpx.Client() as client:
        for province in provinces:
            df = fetch_latest(client, province)
            if df is not None:
                upsert_province(conn, province)
                rows = df_to_rows(df)
                if rows:
                    upsert_readings(conn, rows)
                    total_upserted += len(rows)
            time.sleep(REQUEST_DELAY_S)

    conn.close()
    log.info("── Hoàn thành: upserted %d dòng ────────────────────────────", total_upserted)


if __name__ == "__main__":
    run()
