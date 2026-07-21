"""
queries.py
----------
Tất cả raw SQL query cho dashboard và analytics.
Không dùng ORM — raw asyncpg để tận dụng TimescaleDB-specific functions.

Quy ước:
  - Mỗi function nhận pool hoặc connection làm tham số đầu tiên
  - Trả về list[asyncpg.Record] hoặc dict — KHÔNG trả về model Pydantic (việc đó ở services/)
  - Comment SQL giải thích tại sao dùng query đó, không chỉ là "what"
"""

import asyncpg
from datetime import date


# ── Overview / KPI ─────────────────────────────────────────────────────────────

async def get_national_kpi(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
) -> dict:
    """
    KPI toàn quốc: AQI trung bình, PM2.5 trung bình,
    số tỉnh vượt ngưỡng AQI > 100, tổng số bất thường.
    Dùng daily_aqi continuous aggregate để query nhanh.
    """
    row = await pool.fetchrow(
        """
        SELECT
            ROUND(AVG(aqi_avg)::NUMERIC, 1)   AS aqi_national,
            ROUND(AVG(pm2_5_avg)::NUMERIC, 1) AS pm25_national,
            COUNT(DISTINCT province_id)
                FILTER (WHERE aqi_max > 100)  AS provinces_exceeded,
            SUM(reading_count)                AS total_readings
        FROM daily_aqi
        WHERE day >= $1 AND day <= $2
        """,
        start_date, end_date,
    )
    return dict(row) if row else {}


async def get_top_polluted_provinces(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
    limit: int = 5,
) -> list[dict]:
    """Top N tỉnh ô nhiễm nhất (AQI trung bình cao nhất) trong kỳ."""
    rows = await pool.fetch(
        """
        SELECT
            p.id          AS province_id,
            p.name        AS province_name,
            ROUND(AVG(d.aqi_avg)::NUMERIC, 1) AS aqi_avg,
            ROUND(AVG(d.pm2_5_avg)::NUMERIC, 1) AS pm25_avg
        FROM daily_aqi d
        JOIN provinces p ON p.id = d.province_id
        WHERE d.day >= $1 AND d.day <= $2
        GROUP BY p.id, p.name
        ORDER BY aqi_avg DESC NULLS LAST
        LIMIT $3
        """,
        start_date, end_date, limit,
    )
    return [dict(r) for r in rows]


async def get_aqi_trend(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
    province_id: int | None = None,
) -> list[dict]:
    """
    Xu hướng AQI theo ngày (cho line chart).
    Nếu province_id = None → trung bình toàn quốc.
    """
    if province_id:
        rows = await pool.fetch(
            """
            SELECT day, ROUND(aqi_avg::NUMERIC, 1) AS aqi
            FROM daily_aqi
            WHERE day >= $1 AND day <= $2
              AND province_id = $3
            ORDER BY day
            """,
            start_date, end_date, province_id,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT day, ROUND(AVG(aqi_avg)::NUMERIC, 1) AS aqi
            FROM daily_aqi
            WHERE day >= $1 AND day <= $2
            GROUP BY day
            ORDER BY day
            """,
            start_date, end_date,
        )
    return [dict(r) for r in rows]


# ── Map ────────────────────────────────────────────────────────────────────────

async def get_latest_aqi_all_provinces(pool: asyncpg.Pool) -> list[dict]:
    """
    AQI mới nhất của tất cả 63 tỉnh — dùng cho choropleth map.
    Dùng DISTINCT ON để lấy bản ghi gần nhất theo province_id.
    """
    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (province_id)
            province_id,
            european_aqi  AS aqi,
            pm2_5,
            time
        FROM env_readings
        WHERE time >= (SELECT MAX(time) FROM env_readings) - INTERVAL '6 hours'
        ORDER BY province_id, time DESC
        """
    )
    return [dict(r) for r in rows]


async def get_province_detail(
    pool: asyncpg.Pool,
    province_id: int,
) -> dict:
    """Dữ liệu giờ gần nhất của một tỉnh — dùng cho panel chi tiết trên bản đồ."""
    row = await pool.fetchrow(
        """
        SELECT
            e.time, e.province_id,
            p.name AS province_name,
            e.european_aqi, e.pm2_5, e.pm10,
            e.carbon_monoxide, e.nitrogen_dioxide,
            e.sulphur_dioxide, e.ozone, e.dust
        FROM env_readings e
        JOIN provinces p ON p.id = e.province_id
        WHERE e.province_id = $1
        ORDER BY e.time DESC
        LIMIT 1
        """,
        province_id,
    )
    return dict(row) if row else {}


# ── Analysis / Comparison ──────────────────────────────────────────────────────

async def get_timeseries(
    pool: asyncpg.Pool,
    province_id: int | None,
    metric: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Time-series theo giờ của một metric — dùng cho line chart Tab Phân tích.
    province_id = None → trung bình toàn quốc theo giờ.
    CẢNH BÁO: metric phải được validate trước khi đưa vào — dùng whitelist.
    """
    ALLOWED_METRICS = {
        "pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide",
        "sulphur_dioxide", "ozone", "dust", "european_aqi",
    }
    if metric not in ALLOWED_METRICS:
        raise ValueError(f"Metric không hợp lệ: {metric}")

    # Không dùng f-string cho giá trị — chỉ cho tên cột đã qua whitelist,
    # vì asyncpg không hỗ trợ bind dynamic column name bằng $N.
    if province_id:
        rows = await pool.fetch(
            f"""
            SELECT time, {metric} AS value
            FROM env_readings
            WHERE province_id = $1
              AND time >= $2::date
              AND time <  $3::date + INTERVAL '1 day'
              AND {metric} IS NOT NULL
            ORDER BY time
            """,
            province_id, start_date, end_date,
        )
    else:
        # Toàn quốc: trung bình cộng các tỉnh theo từng giờ
        rows = await pool.fetch(
            f"""
            SELECT time, ROUND(AVG({metric})::NUMERIC, 2) AS value
            FROM env_readings
            WHERE time >= $1::date
              AND time <  $2::date + INTERVAL '1 day'
              AND {metric} IS NOT NULL
            GROUP BY time
            ORDER BY time
            """,
            start_date, end_date,
        )
    return [{"time": r["time"].isoformat(), "value": r["value"]} for r in rows]


async def get_daily_stats_for_provinces(
    pool: asyncpg.Pool,
    province_ids: list[int],
    start_date: date,
    end_date: date,
) -> list[dict]:
    """
    Thống kê min/max/mean/stddev cho nhiều tỉnh — dùng cho Tab So sánh.
    """
    rows = await pool.fetch(
        """
        SELECT
            province_id,
            ROUND(AVG(aqi_avg)::NUMERIC, 2)  AS aqi_mean,
            ROUND(MAX(aqi_max)::NUMERIC, 2)  AS aqi_max,
            ROUND(MIN(aqi_min)::NUMERIC, 2)  AS aqi_min,
            ROUND(AVG(pm2_5_avg)::NUMERIC, 2) AS pm25_mean
        FROM daily_aqi
        WHERE province_id = ANY($1::smallint[])
          AND day >= $2 AND day <= $3
        GROUP BY province_id
        ORDER BY aqi_mean DESC
        """,
        province_ids, start_date, end_date,
    )
    return [dict(r) for r in rows]


# ── Analytics (Z-score + Correlation) dùng raw data ───────────────────────────

async def get_raw_readings_for_analytics(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
    province_id: int | None = None,
) -> list[dict]:
    """
    Lấy toàn bộ dữ liệu hourly để chạy Z-score và Pearson trong Python.
    Giới hạn tối đa 1 năm để tránh quá tải memory.
    """
    if province_id:
        rows = await pool.fetch(
            """
            SELECT time, province_id, pm2_5, pm10, carbon_monoxide,
                   nitrogen_dioxide, sulphur_dioxide, ozone, dust, european_aqi
            FROM env_readings
            WHERE province_id = $1
              AND time >= $2::date
              AND time <  $3::date + INTERVAL '1 day'
            ORDER BY time
            """,
            province_id, start_date, end_date,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT time, province_id, pm2_5, pm10, carbon_monoxide,
                   nitrogen_dioxide, sulphur_dioxide, ozone, dust, european_aqi
            FROM env_readings
            WHERE time >= $1::date
              AND time <  $2::date + INTERVAL '1 day'
            ORDER BY time
            """,
            start_date, end_date,
        )
    return [dict(r) for r in rows]
