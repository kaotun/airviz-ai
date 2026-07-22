"""
execution_service.py
--------------------
Safe SQL Execution Sandbox cho AI Chatbox.

Chỉ chạy SQL đã được người dùng Approve (ai_logs.approved_at IS NOT NULL).
Áp dụng các lớp bảo vệ:
  - Timeout 30 giây
  - Giới hạn tối đa 500 dòng
  - Read-only transaction (SET TRANSACTION READ ONLY)
  - Serialize kết quả sang JSON-safe dict
"""

import asyncio
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any
import asyncpg

log = logging.getLogger(__name__)

MAX_ROWS = 500
EXEC_TIMEOUT_SECONDS = 30


def _serialize_value(v: Any) -> Any:
    """Chuyển đổi các kiểu dữ liệu không JSON-serializable."""
    if isinstance(v, (datetime,)):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if v is None:
        return None
    return v


def _serialize_row(row: asyncpg.Record) -> dict:
    """Chuyển asyncpg.Record thành dict JSON-safe."""
    return {k: _serialize_value(v) for k, v in dict(row).items()}


async def execute_sql(pool: asyncpg.Pool, sql: str) -> dict:
    """
    Thực thi câu SQL an toàn trong read-only transaction.

    Returns:
        {
          "columns": list[str],
          "rows": list[dict],
          "row_count": int,
          "truncated": bool,   # True nếu kết quả bị cắt bớt
          "error": str | None,
        }
    """
    async def _run():
        async with pool.acquire() as conn:
            # Bật chế độ read-only để đảm bảo không thể ghi dữ liệu
            async with conn.transaction():
                await conn.execute("SET TRANSACTION READ ONLY")

                # Thêm LIMIT nếu chưa có để tránh trả về quá nhiều dòng
                sql_limited = _inject_limit(sql, MAX_ROWS + 1)

                rows = await conn.fetch(sql_limited)
                truncated = len(rows) > MAX_ROWS
                rows = rows[:MAX_ROWS]

                columns = list(rows[0].keys()) if rows else []
                serialized = [_serialize_row(r) for r in rows]

                return {
                    "columns": columns,
                    "rows": serialized,
                    "row_count": len(serialized),
                    "truncated": truncated,
                    "error": None,
                }

    try:
        result = await asyncio.wait_for(_run(), timeout=EXEC_TIMEOUT_SECONDS)
        log.info(f"execute_sql thành công: {result['row_count']} dòng")
        return result
    except asyncio.TimeoutError:
        msg = f"Truy vấn vượt quá timeout {EXEC_TIMEOUT_SECONDS}s."
        log.warning(msg)
        return {"columns": [], "rows": [], "row_count": 0, "truncated": False, "error": msg}
    except asyncpg.PostgresError as e:
        msg = f"Lỗi PostgreSQL: {e.sqlstate} — {e.message}"
        log.error(f"execute_sql PostgresError: {e}")
        return {"columns": [], "rows": [], "row_count": 0, "truncated": False, "error": msg}
    except Exception as e:
        msg = f"Lỗi không xác định khi thực thi SQL: {str(e)}"
        log.error(f"execute_sql Exception: {e}", exc_info=True)
        return {"columns": [], "rows": [], "row_count": 0, "truncated": False, "error": msg}


def _inject_limit(sql: str, limit: int) -> str:
    """
    Thêm hoặc giảm LIMIT vào câu SQL nếu chưa có hoặc vượt ngưỡng an toàn.
    """
    import re
    sql = sql.strip().rstrip(";")

    # Tìm LIMIT hiện có
    limit_match = re.search(r"\bLIMIT\s+(\d+)\b", sql, re.IGNORECASE)
    if limit_match:
        existing_limit = int(limit_match.group(1))
        if existing_limit > limit:
            # Giảm xuống mức an toàn
            sql = re.sub(
                r"\bLIMIT\s+\d+\b",
                f"LIMIT {limit}",
                sql,
                flags=re.IGNORECASE,
            )
    else:
        sql = f"{sql} LIMIT {limit}"

    return sql
