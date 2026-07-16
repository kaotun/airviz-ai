"""
dashboard.py — Dashboard API routes
Mỗi route: validate params → get DB pool → gọi data_service → trả về JSON
Không có business logic ở đây.
"""

from datetime import date, timedelta
import asyncio
from fastapi import APIRouter, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect

from app.db.connection import get_pool
from app.services import data_service
from app.cache.redis import cached

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _default_start() -> date:
    return date.today() - timedelta(days=30)


def _default_end() -> date:
    return date.today()


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
@cached(ttl_seconds=900)
async def get_overview(
    start_date: date = Query(default_factory=_default_start),
    end_date:   date = Query(default_factory=_default_end),
    pool=Depends(get_pool),
):
    """
    KPI toàn quốc: AQI trung bình, PM2.5, số tỉnh vượt ngưỡng AQI > 100, top 5 tỉnh ô nhiễm nhất.
    Cache TTL: 15 phút.
    """
    return await data_service.get_overview_kpi(pool, start_date, end_date)


# ── Map ───────────────────────────────────────────────────────────────────────

@router.get("/map")
@cached(ttl_seconds=300)
async def get_map_data(pool=Depends(get_pool)):
    """
    AQI mới nhất của tất cả 63 tỉnh — dùng cho choropleth map.
    Lấy bản ghi gần nhất trong vòng 6 giờ qua.
    Cache TTL: 5 phút.
    """
    return await data_service.get_map_data(pool)


@router.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket, pool=Depends(get_pool)):
    """
    Phát dữ liệu AQI map mới nhất mỗi 60 giây.
    """
    await websocket.accept()
    try:
        while True:
            data = await data_service.get_map_data(pool)
            await websocket.send_json(data)
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass



@router.get("/province/{province_id}")
async def get_province_detail(
    province_id: int,
    pool=Depends(get_pool),
):
    """
    Chi tiết đọc gần nhất của một tỉnh — dùng cho panel chi tiết khi click vào bản đồ.
    """
    data = await data_service.get_province_detail(pool, province_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dữ liệu cho tỉnh id={province_id}")
    return data


# ── Trend ─────────────────────────────────────────────────────────────────────

@router.get("/trend")
@cached(ttl_seconds=1800)
async def get_trend(
    start_date:  date     = Query(default_factory=_default_start),
    end_date:    date     = Query(default_factory=_default_end),
    province_id: int | None = Query(None, description="ID tỉnh. Bỏ trống = toàn quốc."),
    pool=Depends(get_pool),
):
    """
    Xu hướng AQI theo ngày — dùng cho line chart Tab Tổng quan.
    Nếu không truyền province_id → tính trung bình toàn quốc.
    Cache TTL: 30 phút.
    """
    return await data_service.get_aqi_trend(pool, start_date, end_date, province_id)


# ── Top polluted ──────────────────────────────────────────────────────────────

@router.get("/top-polluted")
@cached(ttl_seconds=1800)
async def get_top_polluted(
    start_date: date = Query(default_factory=_default_start),
    end_date:   date = Query(default_factory=_default_end),
    limit:      int  = Query(5, ge=1, le=20),
    pool=Depends(get_pool),
):
    """
    Top N tỉnh ô nhiễm nhất theo AQI trung bình — dùng cho bar chart nằm ngang.
    Cache TTL: 30 phút.
    """
    return await data_service.get_top_polluted(pool, start_date, end_date, limit)


# ── Comparison ────────────────────────────────────────────────────────────────

@router.get("/comparison")
@cached(ttl_seconds=1800)
async def get_comparison(
    province_ids: str  = Query(..., description="ID tỉnh phân cách bằng dấu phẩy. VD: 1,2,3"),
    metric:       str  = Query("european_aqi", description="Metric để so sánh time-series"),
    start_date:   date = Query(default_factory=_default_start),
    end_date:     date = Query(default_factory=_default_end),
    pool=Depends(get_pool),
):
    """
    So sánh tối đa 3 tỉnh: time-series AQI + bảng thống kê min/max/mean.
    Cache TTL: 30 phút.
    """
    try:
        ids = [int(i.strip()) for i in province_ids.split(",") if i.strip().isdigit()]
    except ValueError:
        raise HTTPException(status_code=400, detail="province_ids phải là danh sách số nguyên. VD: 1,2,3")

    if not ids:
        raise HTTPException(status_code=400, detail="Cần ít nhất 1 province_id hợp lệ.")
    if len(ids) > 3:
        raise HTTPException(status_code=400, detail="Tối đa 3 tỉnh để so sánh.")

    return await data_service.get_comparison_data(pool, ids, metric, start_date, end_date)
