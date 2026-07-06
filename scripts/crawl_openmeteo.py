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
REQUEST_DELAY_S = 1.2

# Số lần retry tối đa nếu request thất bại
MAX_RETRIES = 3

# Kích thước batch insert vào DB
BATCH_SIZE = 1000

# Đường dẫn file provinces
PROVINCES_FILE = Path(__file__).parent.parent / "data" / "provinces.json"


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
def date_chunks(start_str, end_str, months=6):
    """Chia khoảng thời gian dài thành các chunk nhỏ (mặc định 6 tháng)."""
    start = datetime.strptime(start_str, "%Y-%m-%d")
    end = datetime.strptime(end_str, "%Y-%m-%d")
    chunks = []
    current = start
    while current < end:
        next_chunk = current + timedelta(days=months * 30)
        chunk_end = min(next_chunk - timedelta(days=1), end)
        chunks.append((current.strftime("%Y-%m-%d"), chunk_end.strftime("%Y-%m-%d")))
        current = next_chunk
    return chunks


def fetch_air_quality(
    client: httpx.Client,
    province: dict,
    start_date: str,
    end_date: str,
) -> pd.DataFrame | None:
    """
    Gọi Open-Meteo API cho một tỉnh trong khoảng thời gian cho trước.
    Tự động chia nhỏ thành các chunk 6 tháng để tránh lỗi response quá lớn.
    """
    all_chunks = []

    for chunk_start, chunk_end in date_chunks(start_date, end_date, months=6):
        params = {
            "latitude": province["Latitude"],
            "longitude": province["Longitude"],
            "hourly": ",".join(HOURLY_VARIABLES),
            "start_date": chunk_start,
            "end_date": chunk_end,
            "timezone": "Asia/Ho_Chi_Minh",
        }

        chunk_df = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = client.get(OPENMETEO_URL, params=params, timeout=60.0)
                response.raise_for_status()
                data = response.json()

                hourly = data.get("hourly", {})
                if not hourly or "time" not in hourly:
                    log.warning(
                        "[%s] Không có dữ liệu hourly trong response chunk %s-%s",
                        province["Province"], chunk_start, chunk_end
                    )
                    break

                df = pd.DataFrame(hourly)
                df["time"] = pd.to_datetime(df["time"])
                df["province_id"] = province["Code"]
                chunk_df = df
                break  # Thành công, thoát vòng lặp retry

            except httpx.HTTPStatusError as e:
                log.warning(
                    "[%s][%s-%s] Lần %d/%d — HTTP %d: %s",
                    province["Province"], chunk_start, chunk_end, attempt, MAX_RETRIES,
                    e.response.status_code, e.response.text[:200],
                )
            except (httpx.RequestError, httpx.TimeoutException) as e:
                log.warning(
                    "[%s][%s-%s] Lần %d/%d — Request error: %s",
                    province["Province"], chunk_start, chunk_end, attempt, MAX_RETRIES, str(e),
                )

            if attempt < MAX_RETRIES:
                wait = 2 ** attempt
                log.info("[%s] Chờ %ds trước khi retry...", province["Province"], wait)
                time.sleep(wait)

        if chunk_df is not None:
            all_chunks.append(chunk_df)
            
        time.sleep(REQUEST_DELAY_S)

    if all_chunks:
        return pd.concat(all_chunks, ignore_index=True)
    
    log.error("[%s] Thất bại tải dữ liệu.", province["Province"])
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

    if not PROVINCES_FILE.exists():
        log.error("Không tìm thấy file %s. Chạy notebook 01 để tạo trước.", PROVINCES_FILE)
        return

    with open(PROVINCES_FILE, "r", encoding="utf-8") as f:
        provinces = json.load(f)

    # Lọc những tỉnh chưa có tọa độ
    valid_provinces = [p for p in provinces if p.get("Latitude") and p.get("Longitude")]
    log.info("Load thành công %d/%d tỉnh có tọa độ.", len(valid_provinces), len(provinces))

    if args.province_id:
        valid_provinces = [p for p in valid_provinces if int(p["Code"]) == args.province_id]
        log.info("Debug mode: Chỉ crawl tỉnh ID %d", args.province_id)

    # Khởi tạo connection DB
    try:
        conn = get_db_connection()
        log.info("Kết nối TimescaleDB thành công.")
    except Exception as e:
        log.error("Lỗi kết nối DB: %s. Chắc chắn container timescaledb đang chạy.", e)
        return

    success_count = 0
    total_rows = 0

    with httpx.Client(timeout=60.0) as client:
        for idx, province in enumerate(valid_provinces, 1):
            log.info(
                "[%02d/%d] Đang tải: %-20s",
                idx, len(valid_provinces), province["Province"]
            )

            # 1. Upsert tỉnh vào DB
            slug = province["Province"].lower().replace(" ", "-").replace("đ", "d")
            db_province = {
                "id": int(province["Code"]),
                "slug": slug,
                "name": province["Province"],
                "latitude": province["Latitude"],
                "longitude": province["Longitude"],
            }
            upsert_province(conn, db_province)

            # 2. Fetch dữ liệu API (sử dụng chunking)
            df = fetch_air_quality(client, province, args.start, args.end)

            if df is not None and not df.empty:
                # 3. Transform & Clean
                rows = df_to_rows(df)

                # 4. Insert DB
                upsert_readings(conn, rows)
                success_count += 1
                total_rows += len(rows)
                log.info("   ↳ Đã lưu %d dòng vào DB.", len(rows))
            else:
                log.warning("   ↳ Bỏ qua do không có dữ liệu.")

    conn.close()
    log.info("═" * 60)
    log.info("Hoàn thành! Thành công: %d/%d tỉnh. Tổng rows: %s",
             success_count, len(valid_provinces), f"{total_rows:,}")


if __name__ == "__main__":
    main()
