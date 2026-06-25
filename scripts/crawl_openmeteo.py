"""
crawl_openmeteo.py
------------------
Thu thập dữ liệu chất lượng không khí lịch sử cho 63 tỉnh thành Việt Nam
từ Open-Meteo Air Quality API (miễn phí, không cần API key).

Sử dụng:
    python scripts/crawl_openmeteo.py
    python scripts/crawl_openmeteo.py --start 2024-01-01 --end 2024-12-31
    python scripts/crawl_openmeteo.py --province-id 1  # chỉ crawl Hà Nội
"""

import argparse
import json
import logging
import os
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────
OPENMETEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# Các biến thu thập từ Open-Meteo (≥ 7 biến độc lập theo yêu cầu đề bài)
HOURLY_VARIABLES = [
    "pm2_5",
    "pm10",
    "carbon_monoxide",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "ozone",
    "dust",
    "european_aqi",
]

# Thời gian nghỉ giữa mỗi request để tránh rate limit (giây)
REQUEST_DELAY_S = 0.15

# Số lần retry tối đa nếu request thất bại
MAX_RETRIES = 3

# Kích thước batch insert vào DB
BATCH_SIZE = 1000

# Đường dẫn file provinces
PROVINCES_FILE = Path(__file__).parent / "provinces.json"


# ── Database ──────────────────────────────────────────────────────────────────
def get_db_connection():
    """Kết nối tới TimescaleDB từ biến môi trường."""
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "airviz"),
        user=os.getenv("POSTGRES_USER", "airviz_user"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def upsert_province(conn, province: dict):
    """Insert tỉnh vào bảng provinces nếu chưa tồn tại."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO provinces (id, slug, name, latitude, longitude)
            VALUES (%(id)s, %(slug)s, %(name)s, %(latitude)s, %(longitude)s)
            ON CONFLICT (id) DO NOTHING
            """,
            province,
        )
    conn.commit()


def upsert_readings(conn, rows: list[tuple]):
    """
    Batch upsert các dòng đo lường vào env_readings.
    Mỗi tuple: (time, province_id, pm2_5, pm10, co, no2, so2, o3, dust, european_aqi)
    """
    if not rows:
        return
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
            template=None,
            page_size=BATCH_SIZE,
        )
    conn.commit()


# ── API ───────────────────────────────────────────────────────────────────────
def fetch_air_quality(
    client: httpx.Client,
    province: dict,
    start_date: str,
    end_date: str,
) -> pd.DataFrame | None:
    """
    Gọi Open-Meteo API cho một tỉnh trong khoảng thời gian cho trước.
    Tự động retry tối đa MAX_RETRIES lần với exponential backoff.
    Trả về DataFrame hoặc None nếu thất bại.
    """
    params = {
        "latitude": province["latitude"],
        "longitude": province["longitude"],
        "hourly": ",".join(HOURLY_VARIABLES),
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Ho_Chi_Minh",
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.get(OPENMETEO_URL, params=params, timeout=30.0)
            response.raise_for_status()
            data = response.json()

            hourly = data.get("hourly", {})
            if not hourly or "time" not in hourly:
                log.warning(
                    "[%s] Không có dữ liệu hourly trong response",
                    province["name"],
                )
                return None

            df = pd.DataFrame(hourly)
            df["time"] = pd.to_datetime(df["time"])
            df["province_id"] = province["id"]
            return df

        except httpx.HTTPStatusError as e:
            log.warning(
                "[%s] Lần %d/%d — HTTP %d: %s",
                province["name"], attempt, MAX_RETRIES,
                e.response.status_code, e.response.text[:200],
            )
        except (httpx.RequestError, httpx.TimeoutException) as e:
            log.warning(
                "[%s] Lần %d/%d — Request error: %s",
                province["name"], attempt, MAX_RETRIES, str(e),
            )

        if attempt < MAX_RETRIES:
            wait = 2 ** attempt  # 2s, 4s
            log.info("[%s] Chờ %ds trước khi retry...", province["name"], wait)
            time.sleep(wait)

    log.error("[%s] Thất bại sau %d lần thử, bỏ qua.", province["name"], MAX_RETRIES)
    return None


# ── Transform ─────────────────────────────────────────────────────────────────
def df_to_rows(df: pd.DataFrame) -> list[tuple]:
    """
    Chuyển DataFrame thành list tuples để insert vào DB.
    Bỏ qua các hàng bị null ở tất cả các biến đo lường.
    Interpolate tuyến tính nếu gap < 3 giờ liên tiếp.
    """
    measure_cols = [c for c in HOURLY_VARIABLES if c in df.columns]

    # Interpolate linear cho gap nhỏ (≤ 3 giờ = 3 bước)
    df[measure_cols] = df[measure_cols].interpolate(
        method="linear", limit=3, limit_direction="both"
    )

    # Drop hàng vẫn còn null sau interpolate (gap quá lớn)
    df = df.dropna(subset=measure_cols, how="all")

    rows = []
    for _, row in df.iterrows():
        rows.append((
            row["time"].to_pydatetime(),
            int(row["province_id"]),
            _safe_float(row.get("pm2_5")),
            _safe_float(row.get("pm10")),
            _safe_float(row.get("carbon_monoxide")),
            _safe_float(row.get("nitrogen_dioxide")),
            _safe_float(row.get("sulphur_dioxide")),
            _safe_float(row.get("ozone")),
            _safe_float(row.get("dust")),
            _safe_float(row.get("european_aqi")),
        ))
    return rows


def _safe_float(val) -> float | None:
    """Trả về None nếu val là NaN hoặc None."""
    try:
        f = float(val)
        return None if pd.isna(f) else f
    except (TypeError, ValueError):
        return None


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Crawl Open-Meteo Air Quality data for 63 Vietnamese provinces"
    )
    parser.add_argument(
        "--start",
        default=os.getenv("SEED_START_DATE", "2024-01-01"),
        help="Ngày bắt đầu (YYYY-MM-DD). Mặc định: 2024-01-01",
    )
    parser.add_argument(
        "--end",
        default=os.getenv("SEED_END_DATE", date.today().isoformat()),
        help="Ngày kết thúc (YYYY-MM-DD). Mặc định: hôm nay",
    )
    parser.add_argument(
        "--province-id",
        type=int,
        default=None,
        help="Chỉ crawl một tỉnh cụ thể theo ID (debug mode)",
    )
    args = parser.parse_args()

    log.info("═" * 60)
    log.info("AirViz.AI — Open-Meteo Historical Crawler")
    log.info("Khoảng thời gian: %s → %s", args.start, args.end)
    log.info("═" * 60)

    # Load danh sách tỉnh
    provinces: list[dict] = json.loads(PROVINCES_FILE.read_text(encoding="utf-8"))
    if args.province_id:
        provinces = [p for p in provinces if p["id"] == args.province_id]
        if not provinces:
            log.error("Không tìm thấy tỉnh với id=%d", args.province_id)
            return

    # Kết nối DB
    conn = get_db_connection()
    log.info("✓ Kết nối TimescaleDB thành công")

    total_inserted = 0
    failed_provinces = []

    with httpx.Client() as client:
        for idx, province in enumerate(provinces, start=1):
            log.info(
                "[%d/%d] Đang crawl: %s ...",
                idx, len(provinces), province["name"],
            )

            # Upsert province record
            upsert_province(conn, province)

            # Gọi API
            df = fetch_air_quality(client, province, args.start, args.end)
            if df is None:
                failed_provinces.append(province["name"])
                time.sleep(REQUEST_DELAY_S)
                continue

            # Transform & insert
            rows = df_to_rows(df)
            if rows:
                upsert_readings(conn, rows)
                total_inserted += len(rows)
                log.info(
                    "  ✓ Inserted %d dòng (tổng: %d)",
                    len(rows), total_inserted,
                )
            else:
                log.warning("  ⚠ Không có dòng hợp lệ sau khi làm sạch.")

            # Nghỉ giữa các request
            time.sleep(REQUEST_DELAY_S)

    conn.close()

    # Tổng kết
    log.info("═" * 60)
    log.info("Hoàn thành!")
    log.info("  Tổng số dòng đã insert: %d", total_inserted)
    log.info("  Tỉnh thành công: %d / %d", len(provinces) - len(failed_provinces), len(provinces))
    if failed_provinces:
        log.warning("  Tỉnh thất bại: %s", ", ".join(failed_provinces))
    log.info("═" * 60)


if __name__ == "__main__":
    main()
