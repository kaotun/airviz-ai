"""
connection.py
-------------
Quản lý asyncpg connection pool cho toàn bộ backend.
Pool được tạo một lần khi app khởi động (lifespan event)
và đóng lại khi app shutdown — không mở/đóng pool theo từng request.
"""

import os
import logging

import asyncpg

log = logging.getLogger(__name__)

# Pool singleton — được set trong lifespan của main.py
_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Tạo asyncpg connection pool từ biến môi trường."""
    dsn = (
        f"postgresql://{os.getenv('POSTGRES_USER', 'airviz_user')}"
        f":{os.getenv('POSTGRES_PASSWORD', '')}"
        f"@{os.getenv('POSTGRES_HOST', 'localhost')}"
        f":{os.getenv('POSTGRES_PORT', '5432')}"
        f"/{os.getenv('POSTGRES_DB', 'airviz')}"
    )

    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=2,
        max_size=10,
        command_timeout=30,
        statement_cache_size=100,   # prepared statement cache
    )
    log.info("✓ asyncpg pool tạo thành công (min=2, max=10)")
    return pool


async def close_pool(pool: asyncpg.Pool) -> None:
    """Đóng pool khi app shutdown."""
    await pool.close()
    log.info("Pool đã đóng.")


def get_pool() -> asyncpg.Pool:
    """
    Dependency injection cho FastAPI.
    Dùng trong route handler: pool = Depends(get_pool)
    """
    if _pool is None:
        raise RuntimeError("DB pool chưa được khởi tạo. Kiểm tra lifespan event.")
    return _pool


def set_pool(pool: asyncpg.Pool) -> None:
    """Gán pool singleton — gọi từ lifespan của main.py."""
    global _pool
    _pool = pool
