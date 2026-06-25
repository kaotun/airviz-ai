"""dashboard.py — Dashboard API routes (Phase 2)"""
from fastapi import APIRouter, Query
from datetime import date

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
async def get_overview(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """KPI toàn quốc: AQI trung bình, PM2.5, số tỉnh vượt ngưỡng."""
    # TODO Phase 2: kết nối DB thật
    return {"aqi_national": None, "pm25_national": None, "provinces_exceeded": None}


@router.get("/map")
async def get_map_data():
    """AQI mới nhất tất cả 63 tỉnh — cho choropleth map."""
    return {"provinces": []}


@router.get("/trend")
async def get_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    province_id: int | None = Query(None),
):
    """Xu hướng AQI theo ngày."""
    return {"trend": []}


@router.get("/top-polluted")
async def get_top_polluted(
    start_date: date = Query(...),
    end_date: date = Query(...),
    limit: int = Query(5, ge=1, le=20),
):
    """Top N tỉnh ô nhiễm nhất."""
    return {"provinces": []}


@router.get("/province/{province_id}")
async def get_province_detail(province_id: int):
    """Chi tiết dữ liệu mới nhất của một tỉnh."""
    return {"province_id": province_id, "data": None}


@router.get("/comparison")
async def get_comparison(
    province_ids: str = Query(..., description="Danh sách ID tỉnh, phân cách bằng dấu phẩy. VD: 1,2,3"),
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Dữ liệu so sánh nhiều tỉnh."""
    ids = [int(i) for i in province_ids.split(",") if i.strip().isdigit()]
    return {"province_ids": ids, "stats": []}
