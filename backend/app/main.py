"""
main.py
-------
FastAPI application entry point.
Quản lý:
  - Lifespan: khởi tạo và đóng DB pool + Redis
  - Router registration
  - Global exception handler
  - CORS cho frontend dev (localhost:5173)
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db import connection as db_conn
from app.api.v1 import dashboard, analytics, ai, logs

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


# ── Lifespan: startup / shutdown ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Khởi tạo tài nguyên khi app start, giải phóng khi app stop.
    Thay thế deprecated on_event("startup") của FastAPI cũ.
    """
    log.info("═" * 50)
    log.info("AirViz.AI Backend đang khởi động...")

    # Tạo DB pool
    pool = await db_conn.create_pool()
    db_conn.set_pool(pool)

    # TODO Phase 2: khởi tạo Redis pool
    # from app.cache import redis as cache
    # await cache.init()

    log.info("═" * 50)
    yield  # ← app chạy ở đây

    # Shutdown
    log.info("Đang tắt backend...")
    await db_conn.close_pool(pool)
    log.info("Bye!")


# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="AirViz.AI — Backend API",
    description=(
        "API phục vụ dashboard trực quan hoá chất lượng không khí Việt Nam "
        "và AI chatbox Text2SQL với Human-in-the-loop."
    ),
    version="0.1.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",   # fallback
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Bắt toàn bộ exception chưa được xử lý.
    Trả về format chuẩn — KHÔNG để stack trace lộ ra ngoài production.
    """
    log.exception("Unhandled exception tại %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code":      "INTERNAL_SERVER_ERROR",
                "message":   "Đã xảy ra lỗi phía server. Vui lòng thử lại sau.",
                "retryable": True,
            }
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code":      "INVALID_PARAMS",
                "message":   str(exc),
                "retryable": False,
            }
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(ai.router,        prefix=API_PREFIX)
app.include_router(logs.router,      prefix=API_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint — dùng cho Docker healthcheck và monitoring.
    Kiểm tra DB pool còn sống không.
    """
    pool = db_conn.get_pool()
    try:
        await pool.fetchval("SELECT 1")
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status":    "ok" if db_status == "ok" else "degraded",
        "db":        db_status,
        "version":   "0.1.0",
    }


@app.get("/", tags=["system"])
async def root():
    return {"status": "ok", "message": "AirViz.AI API is running. Visit /docs for Swagger UI."}
