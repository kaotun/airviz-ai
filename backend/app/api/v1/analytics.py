"""
analytics.py — API routes cho phân tích thống kê
GET /api/v1/analytics/anomalies  — Z-score anomaly detection
GET /api/v1/analytics/correlation — Pearson correlation matrix
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/analytics", tags=["analytics"])


# Stub — sẽ inject DB pool và cache thật ở Phase 2
# from app.db.connection import get_pool
# from app.cache.redis import get_cache


@router.get("/anomalies")
async def get_anomalies(
    province_id: int | None = Query(None, description="ID tỉnh (bỏ trống = toàn quốc)"),
    metric: Literal["pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide",
                    "sulphur_dioxide", "ozone", "dust"] = Query("pm2_5"),
    threshold: float = Query(2.5, ge=1.0, le=5.0, description="Ngưỡng |z-score|"),
    start_date: date = Query(..., description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: date   = Query(..., description="Ngày kết thúc (YYYY-MM-DD)"),
):
    """
    Phát hiện các điểm đo lường bất thường bằng Rolling Z-score 7 ngày.

    - **province_id**: Lọc theo tỉnh. Nếu bỏ trống sẽ phân tích toàn quốc.
    - **metric**: Biến đo lường cần phân tích (mặc định: pm2_5).
    - **threshold**: Ngưỡng |z-score| để coi là bất thường (mặc định: 2.5σ).
      - `|z| > 2.5` → Cao
      - `|z| > 3.5` → Rất cao
    - **start_date / end_date**: Khoảng thời gian cần phân tích.
    """
    # TODO Phase 2: query DB → pandas → analytics_service.detect_anomalies()
    # Trả về stub để frontend làm việc song song
    return {
        "metric": metric,
        "threshold": threshold,
        "province_id": province_id,
        "period": {"start": str(start_date), "end": str(end_date)},
        "anomalies": [],   # sẽ có data thật sau Phase 2
        "total": 0,
    }


@router.get("/correlation")
async def get_correlation(
    province_id: int | None = Query(None, description="ID tỉnh (bỏ trống = toàn quốc)"),
    start_date: date = Query(..., description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: date   = Query(..., description="Ngày kết thúc (YYYY-MM-DD)"),
):
    """
    Tính ma trận tương quan Pearson cho 7 biến môi trường.

    - **province_id**: Lọc theo tỉnh. Nếu bỏ trống tính trên toàn quốc.
    - Kết quả là ma trận 7×7 với giá trị Pearson r ∈ [-1, 1].
    - Giá trị 1.0 trên đường chéo chính (tự tương quan).
    - Cache TTL: 6 giờ (dữ liệu lịch sử ít thay đổi).
    """
    # TODO Phase 2: query DB → pandas → analytics_service.compute_correlation()
    return {
        "province_id": province_id,
        "period": {"start": str(start_date), "end": str(end_date)},
        "labels":  ["pm2_5", "pm10", "carbon_monoxide", "nitrogen_dioxide",
                    "sulphur_dioxide", "ozone", "dust"],
        "display": ["Bụi mịn PM2.5", "Bụi mịn PM10", "Carbon Monoxide (CO)",
                    "Nitrogen Dioxide (NO₂)", "Sulphur Dioxide (SO₂)",
                    "Ozone (O₃)", "Bụi thô"],
        "matrix":  [],   # sẽ có data thật sau Phase 2
        "sample_size": 0,
    }
