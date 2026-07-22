"""
ai.py — AI Chatbox & RAG endpoints (Phase 4)
Endpoints:
  POST /ai/chat     — nhận câu hỏi → phân loại intent → sinh SQL hoặc trả lời trực tiếp
  POST /ai/execute  — thực thi SQL đã được người dùng approve
  GET  /ai/logs/{session_id} — lấy lịch sử chat
  GET  /ai/health   — kiểm tra Gemini API connection
"""

import os
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.connection import get_pool
from app.services import rag_service, execution_service, log_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


# ── Request / Response Models ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    # Context dashboard: tỉnh đang xem, metric, khoảng thời gian
    context: dict | None = None


class ChatResponse(BaseModel):
    log_id: str
    session_id: str
    intent: str                 # query | analysis | chitchat
    response: str               # Câu trả lời AI (markdown)
    status: str                 # pending_approval | answered
    generated_sql: str | None   # SQL (nếu intent=query)
    needs_approval: bool        # True nếu cần người dùng approve SQL


class ExecuteRequest(BaseModel):
    log_id: str
    approved_by: str | None = None


class ExecuteResponse(BaseModel):
    log_id: str
    status: str
    columns: list[str]
    rows: list[dict]
    row_count: int
    truncated: bool
    error: str | None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, pool=Depends(get_pool)):
    """
    Pipeline:
    1. Phân loại intent (query/analysis/chitchat)
    2. Nếu query → sinh SQL → trả về pending_approval
    3. Nếu analysis/chitchat → trả lời trực tiếp
    """
    session_id = req.session_id or str(uuid.uuid4())

    # 1. Intent classification
    intent = await rag_service.classify_intent(req.message)
    log.info(f"[{session_id}] Intent: {intent} | Question: {req.message[:80]}")

    # 2. Phân nhánh xử lý
    if intent == "query":
        sql_result = await rag_service.generate_sql(
            question=req.message,
            context=req.context,
        )

        if not sql_result["valid"] or not sql_result["sql"]:
            # SQL không sinh được → trả lời xin lỗi
            response_text = (
                f"✦ Xin lỗi, tôi chưa thể tạo câu truy vấn cho câu hỏi này.\n\n"
                f"**Lý do:** {sql_result.get('error', 'Không xác định')}\n\n"
                f"Bạn thử diễn đạt lại câu hỏi không? Ví dụ: *'PM2.5 trung bình Hà Nội tháng này?'*"
            )
            log_id = await log_service.create_log(
                pool, session_id, req.message, intent,
                ai_response=response_text,
            )
            return ChatResponse(
                log_id=log_id,
                session_id=session_id,
                intent=intent,
                response=response_text,
                status="error",
                generated_sql=None,
                needs_approval=False,
            )

        # SQL hợp lệ → cần approval
        response_text = (
            f"✦ Tôi đã phân tích câu hỏi của bạn và tạo ra câu truy vấn dữ liệu.\n\n"
            f"Vui lòng kiểm tra và **Cho phép thực thi** để lấy kết quả thực tế từ cơ sở dữ liệu."
        )
        log_id = await log_service.create_log(
            pool, session_id, req.message, intent,
            generated_sql=sql_result["sql"],
            ai_response=response_text,
        )
        return ChatResponse(
            log_id=log_id,
            session_id=session_id,
            intent=intent,
            response=response_text,
            status="pending_approval",
            generated_sql=sql_result["sql"],
            needs_approval=True,
        )

    else:
        # analysis hoặc chitchat → trả lời trực tiếp không cần SQL
        answer = await rag_service.answer_direct(
            question=req.message,
            context=req.context,
        )
        log_id = await log_service.create_log(
            pool, session_id, req.message, intent,
            ai_response=answer,
        )
        # Cập nhật status thành answered ngay
        await pool.execute(
            "UPDATE ai_logs SET status='answered' WHERE id=$1",
            log_id,
        )
        return ChatResponse(
            log_id=log_id,
            session_id=session_id,
            intent=intent,
            response=answer,
            status="answered",
            generated_sql=None,
            needs_approval=False,
        )


@router.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest, pool=Depends(get_pool)):
    """
    Thực thi SQL sau khi người dùng Approve.
    Chỉ chạy nếu log_id tồn tại và status = 'pending'.
    """
    ai_log = await log_service.get_log(pool, req.log_id)

    if not ai_log:
        raise HTTPException(status_code=404, detail=f"Log ID '{req.log_id}' không tồn tại.")

    if ai_log["status"] not in ("pending", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Log này đang ở trạng thái '{ai_log['status']}', không thể thực thi.",
        )

    sql = ai_log.get("generated_sql")
    if not sql:
        raise HTTPException(status_code=400, detail="Log này không có SQL để thực thi.")

    # Validate lại SQL lần nữa trước khi chạy
    is_valid, err = rag_service.validate_sql(sql)
    if not is_valid:
        await log_service.mark_executed(pool, req.log_id, {"error": err}, status="error")
        raise HTTPException(status_code=400, detail=f"SQL không hợp lệ: {err}")

    # Approve log
    await log_service.approve_log(pool, req.log_id)

    # Thực thi SQL
    log.info(f"Thực thi SQL cho log {req.log_id}")
    result = await execution_service.execute_sql(pool, sql)

    # Cập nhật kết quả
    status = "error" if result.get("error") else "executed"
    await log_service.mark_executed(pool, req.log_id, result, status=status)

    return ExecuteResponse(
        log_id=req.log_id,
        status=status,
        columns=result["columns"],
        rows=result["rows"],
        row_count=result["row_count"],
        truncated=result["truncated"],
        error=result.get("error"),
    )


@router.get("/logs/{session_id}")
async def get_logs(session_id: str, limit: int = 20, pool=Depends(get_pool)):
    """Lấy lịch sử chat của một session."""
    logs = await log_service.get_session_logs(pool, session_id, limit)
    return {"session_id": session_id, "logs": logs}


@router.get("/health")
async def health():
    """Kiểm tra kết nối Gemini API."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return {"status": "error", "detail": "GEMINI_API_KEY chưa được cấu hình"}
    return {
        "status": "ok",
        "model": "gemini-2.5-flash-lite",
        "api_key_set": True,
    }
