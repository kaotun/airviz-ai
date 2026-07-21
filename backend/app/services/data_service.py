"""
data_service.py
---------------
Business logic layer cho dashboard data.
Nhận request params → gọi queries.py → format → trả về dict sạch cho route handler.
Không có SQL ở đây, không có HTTP logic ở đây.
"""

import asyncpg
from datetime import date

from app.db import queries


async def get_overview_kpi(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
) -> dict:
    """KPI toàn quốc cho Tab Tổng quan."""
    kpi = await queries.get_national_kpi(pool, start_date, end_date)
    top5 = await queries.get_top_polluted_provinces(pool, start_date, end_date, limit=5)

    return {
        "kpi": {
            "aqi_national":         kpi.get("aqi_national"),
            "pm25_national":        kpi.get("pm25_national"),
            "provinces_exceeded":   kpi.get("provinces_exceeded"),
            "total_readings":       kpi.get("total_readings"),
        },
        "top_polluted": top5,
        "period": {
            "start": str(start_date),
            "end":   str(end_date),
        },
    }


async def get_map_data(pool: asyncpg.Pool) -> dict:
    """
    Dữ liệu AQI mới nhất cho choropleth map.
    Kèm thông tin tỉnh (name) để frontend không phải lookup riêng.
    """
    rows = await queries.get_latest_aqi_all_provinces(pool)

    # Join tên tỉnh vào kết quả
    provinces_info = await pool.fetch("SELECT id, name, latitude, longitude FROM provinces ORDER BY id")
    province_map = {p["id"]: dict(p) for p in provinces_info}

    features = []
    for row in rows:
        pid = row["province_id"]
        info = province_map.get(pid, {})
        features.append({
            "province_id":   pid,
            "province_name": info.get("name"),
            "latitude":      info.get("latitude"),
            "longitude":     info.get("longitude"),
            "aqi":           row["aqi"],
            "pm2_5":         row["pm2_5"],
            "time":          row["time"].isoformat() if row["time"] else None,
            "aqi_level":     _classify_aqi(row["aqi"]),
        })

    return {
        "provinces": features,
        "total":     len(features),
    }


async def get_province_detail(pool: asyncpg.Pool, province_id: int) -> dict:
    """Chi tiết dữ liệu mới nhất của một tỉnh (dùng cho panel bản đồ)."""
    data = await queries.get_province_detail(pool, province_id)
    if not data:
        return {}

    return {
        "province_id":      data.get("province_id"),
        "province_name":    data.get("province_name"),
        "time":             data["time"].isoformat() if data.get("time") else None,
        "aqi":              data.get("european_aqi"),
        "aqi_level":        _classify_aqi(data.get("european_aqi")),
        "pm2_5":            data.get("pm2_5"),
        "pm10":             data.get("pm10"),
        "carbon_monoxide":  data.get("carbon_monoxide"),
        "nitrogen_dioxide": data.get("nitrogen_dioxide"),
        "sulphur_dioxide":  data.get("sulphur_dioxide"),
        "ozone":            data.get("ozone"),
        "dust":             data.get("dust"),
    }


async def get_aqi_trend(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
    province_id: int | None = None,
) -> dict:
    """Xu hướng AQI theo ngày cho line chart."""
    trend = await queries.get_aqi_trend(pool, start_date, end_date, province_id)

    return {
        "province_id": province_id,
        "period": {"start": str(start_date), "end": str(end_date)},
        "data": [
            {"date": str(r["day"]), "aqi": r["aqi"]}
            for r in trend
        ],
    }


async def get_metric_timeseries(
    pool: asyncpg.Pool,
    province_id: int | None,
    metric: str,
    start_date: date,
    end_date: date,
) -> dict:
    """Chuỗi thời gian theo giờ của một metric — Tab Phân tích."""
    data = await queries.get_timeseries(pool, province_id, metric, start_date, end_date)
    return {
        "province_id": province_id,
        "metric": metric,
        "period": {"start": str(start_date), "end": str(end_date)},
        "data": data,
    }


async def get_top_polluted(
    pool: asyncpg.Pool,
    start_date: date,
    end_date: date,
    limit: int = 5,
) -> dict:
    """Top N tỉnh ô nhiễm nhất — dùng cho bar chart nằm ngang."""
    rows = await queries.get_top_polluted_provinces(pool, start_date, end_date, limit)
    return {
        "period": {"start": str(start_date), "end": str(end_date)},
        "provinces": [
            {
                "province_id":   r["province_id"],
                "province_name": r["province_name"],
                "aqi_avg":       r["aqi_avg"],
                "pm25_avg":      r["pm25_avg"],
                "aqi_level":     _classify_aqi(r["aqi_avg"]),
            }
            for r in rows
        ],
    }


async def get_comparison_data(
    pool: asyncpg.Pool,
    province_ids: list[int],
    metric: str,
    start_date: date,
    end_date: date,
) -> dict:
    """Dữ liệu so sánh nhiều tỉnh (Tab So sánh)."""
    if not province_ids or len(province_ids) > 3:
        raise ValueError("Chọn từ 1 đến 3 tỉnh để so sánh.")

    stats = await queries.get_daily_stats_for_provinces(pool, province_ids, start_date, end_date)

    # Lấy time-series cho từng tỉnh theo metric
    timeseries = {}
    for pid in province_ids:
        ts = await queries.get_timeseries(pool, pid, metric, start_date, end_date)
        timeseries[pid] = [{"date": r["time"], "value": r["value"]} for r in ts]

    return {
        "province_ids": province_ids,
        "period": {"start": str(start_date), "end": str(end_date)},
        "stats": stats,
        "timeseries": timeseries,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_aqi(aqi: float | None) -> str:
    """
    Phân loại AQI theo chuẩn European AQI:
    Good / Fair / Moderate / Poor / Very Poor / Extremely Poor
    """
    if aqi is None:
        return "unknown"
    if aqi <= 20:
        return "good"
    if aqi <= 40:
        return "fair"
    if aqi <= 60:
        return "moderate"
    if aqi <= 80:
        return "poor"
    if aqi <= 100:
        return "very_poor"
    return "extremely_poor"
