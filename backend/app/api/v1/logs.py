"""logs.py — AI Logs history endpoints"""
from fastapi import APIRouter, Query

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def get_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter: pending | approved | rejected | executed | failed"),
):
    """
    Lịch sử toàn bộ request AI với pagination.
    [STUB] Kết nối DB thật ở Phase 2.
    """
    return {
        "page":      page,
        "page_size": page_size,
        "total":     0,
        "items":     [],
    }


@router.get("/{log_id}")
async def get_log_detail(log_id: str):
    """Chi tiết một AI log theo ID."""
    return {"log_id": log_id, "data": None}
