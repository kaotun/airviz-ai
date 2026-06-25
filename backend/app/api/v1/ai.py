"""ai.py — AI Chatbox & RAG endpoints (Phase 4)"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    context: dict | None = None  # dashboard context (province, metric, dateRange)


class ExecuteRequest(BaseModel):
    log_id: str
    approved_by: str | None = None


@router.post("/chat")
async def chat(req: ChatRequest):
    """
    Nhận câu hỏi ngôn ngữ tự nhiên → phân loại intent → sinh SQL/code.
    Trả về response + log_id để theo dõi trạng thái.
    [STUB] RAG thật được implement ở Phase 4.
    """
    return {
        "log_id":      "stub-log-id",
        "intent":      "query",
        "response":    "Tính năng AI đang được phát triển.",
        "status":      "pending",
        "generated_sql": None,
    }


@router.post("/execute")
async def execute(req: ExecuteRequest):
    """
    Thực thi code đã được approve bởi người dùng.
    Chỉ chạy sau khi ai_logs.approved_at được set.
    [STUB] Execution sandbox thật được implement ở Phase 4.
    """
    return {
        "log_id":   req.log_id,
        "status":   "executed",
        "result":   None,
    }
