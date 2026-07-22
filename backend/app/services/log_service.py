"""
log_service.py
--------------
Quản lý vòng đời AI request qua bảng ai_logs:
  pending → approved/rejected → executed/error

Schema bảng ai_logs (tạo sẵn trong DB):
  id UUID, session_id, question, intent, generated_sql,
  status, result_json, created_at, approved_at, executed_at
"""

import json
import logging
import uuid
from datetime import datetime

import asyncpg

log = logging.getLogger(__name__)


async def create_log(
    pool: asyncpg.Pool,
    session_id: str,
    question: str,
    intent: str,
    generated_sql: str | None = None,
    ai_response: str | None = None,
) -> str:
    """
    Tạo bản ghi log mới. Trả về log_id (UUID string).
    """
    log_id = str(uuid.uuid4())
    try:
        await pool.execute(
            """
            INSERT INTO ai_logs
                (id, session_id, question, intent, generated_sql, ai_response, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            """,
            log_id, session_id, question, intent, generated_sql, ai_response,
        )
    except asyncpg.UndefinedTableError:
        # Nếu bảng chưa tồn tại, tự tạo và thử lại
        await _ensure_table(pool)
        await pool.execute(
            """
            INSERT INTO ai_logs
                (id, session_id, question, intent, generated_sql, ai_response, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            """,
            log_id, session_id, question, intent, generated_sql, ai_response,
        )
    except Exception as e:
        log.error(f"create_log thất bại: {e}")
        # Trả về ID tạm thời ngay cả khi DB lỗi (để không chặn flow chat)
    return log_id


async def approve_log(pool: asyncpg.Pool, log_id: str) -> bool:
    """Đánh dấu log đã được người dùng approve."""
    try:
        result = await pool.execute(
            """
            UPDATE ai_logs
            SET status = 'approved', approved_at = NOW()
            WHERE id = $1 AND status = 'pending'
            """,
            log_id,
        )
        return result == "UPDATE 1"
    except Exception as e:
        log.error(f"approve_log thất bại: {e}")
        return False


async def mark_executed(
    pool: asyncpg.Pool,
    log_id: str,
    result: dict,
    status: str = "executed",
) -> None:
    """Cập nhật kết quả sau khi thực thi SQL."""
    try:
        await pool.execute(
            """
            UPDATE ai_logs
            SET status = $2, result_json = $3, executed_at = NOW()
            WHERE id = $1
            """,
            log_id, status, json.dumps(result, ensure_ascii=False),
        )
    except Exception as e:
        log.error(f"mark_executed thất bại: {e}")


async def get_log(pool: asyncpg.Pool, log_id: str) -> dict | None:
    """Lấy thông tin một log theo ID."""
    try:
        row = await pool.fetchrow(
            "SELECT * FROM ai_logs WHERE id = $1", log_id
        )
        if row:
            d = dict(row)
            # Parse result_json nếu có
            if d.get("result_json"):
                try:
                    d["result"] = json.loads(d["result_json"])
                except Exception:
                    d["result"] = None
            return d
    except Exception as e:
        log.error(f"get_log thất bại: {e}")
    return None


async def get_session_logs(
    pool: asyncpg.Pool,
    session_id: str,
    limit: int = 20,
) -> list[dict]:
    """Lấy lịch sử chat theo session_id."""
    try:
        rows = await pool.fetch(
            """
            SELECT id, question, intent, generated_sql, ai_response,
                   status, created_at, approved_at, executed_at
            FROM ai_logs
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            session_id, limit,
        )
        return [dict(r) for r in rows]
    except Exception as e:
        log.error(f"get_session_logs thất bại: {e}")
        return []


async def _ensure_table(pool: asyncpg.Pool) -> None:
    """Tạo bảng ai_logs nếu chưa tồn tại."""
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS ai_logs (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id   VARCHAR(100),
            question     TEXT NOT NULL,
            intent       VARCHAR(20),
            generated_sql TEXT,
            ai_response  TEXT,
            status       VARCHAR(20) DEFAULT 'pending',
            result_json  TEXT,
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            approved_at  TIMESTAMPTZ,
            executed_at  TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_ai_logs_session
            ON ai_logs(session_id, created_at DESC);
    """)
    log.info("✓ Bảng ai_logs đã được tạo.")
