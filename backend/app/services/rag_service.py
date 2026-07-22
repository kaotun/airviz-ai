"""
rag_service.py
--------------
RAG (Retrieval-Augmented Generation) service cho AirViz.AI.

Pipeline:
  1. classify_intent()  → phân loại câu hỏi: query | analysis | chitchat
  2. generate_sql()     → sinh SQL từ câu hỏi (chỉ với intent=query)
  3. validate_sql()     → kiểm tra SQL an toàn (chỉ SELECT)
  4. answer_direct()    → trả lời trực tiếp nếu không cần SQL

Sử dụng Gemini 1.5 Flash qua google-generativeai SDK.
"""

import os
import re
import json
import logging

import google.generativeai as genai

log = logging.getLogger(__name__)

# ── Khởi tạo Gemini ────────────────────────────────────────────────────────────

def _init_gemini() -> genai.GenerativeModel:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY chưa được cấu hình. "
            "Thêm vào file .env: GEMINI_API_KEY=your_key_here"
        )
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        model_name="gemini-2.5-flash-lite",
        generation_config=genai.GenerationConfig(
            temperature=0.1,          # Low temperature → deterministic SQL
            max_output_tokens=1024,
        ),
    )


# ── DB Schema Context (inject vào System Prompt) ────────────────────────────────

DB_SCHEMA = """
Bạn đang làm việc với database TimescaleDB (PostgreSQL) của hệ thống AirViz.AI.

=== SCHEMA ===

-- Bảng 1: provinces (63 tỉnh/thành)
CREATE TABLE provinces (
    id          SMALLINT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,   -- Tên tỉnh bằng tiếng Việt (VD: "Hà Nội")
    region      VARCHAR(50),             -- "Bắc", "Trung", "Nam"
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION
);

-- Bảng 2: env_readings (dữ liệu đo hourly — ~1.3M dòng)
CREATE TABLE env_readings (
    time                TIMESTAMPTZ NOT NULL,
    province_id         SMALLINT REFERENCES provinces(id),
    pm2_5               REAL,           -- µg/m³, WHO limit: 15
    pm10                REAL,           -- µg/m³
    carbon_monoxide     REAL,           -- CO µg/m³
    nitrogen_dioxide    REAL,           -- NO₂ µg/m³
    sulphur_dioxide     REAL,           -- SO₂ µg/m³
    ozone               REAL,           -- O₃ µg/m³
    dust                REAL,           -- Bụi µg/m³
    european_aqi        REAL            -- AQI theo chuẩn châu Âu (0-500+)
);

-- View: daily_aqi (pre-aggregated, dùng cho query nhanh)
CREATE MATERIALIZED VIEW daily_aqi AS
SELECT
    time_bucket('1 day', time) AS day,
    province_id,
    AVG(european_aqi)  AS aqi_avg,
    MAX(european_aqi)  AS aqi_max,
    MIN(european_aqi)  AS aqi_min,
    AVG(pm2_5)         AS pm2_5_avg,
    COUNT(*)           AS reading_count
FROM env_readings
GROUP BY day, province_id;

-- Bảng 3: ai_logs (lịch sử chat AI)
CREATE TABLE ai_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  VARCHAR(100),
    question    TEXT NOT NULL,
    intent      VARCHAR(20),            -- 'query' | 'analysis' | 'chitchat'
    generated_sql TEXT,
    status      VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected | executed | error
    result_json TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ
);

=== LƯU Ý QUAN TRỌNG ===
- Luôn dùng bảng daily_aqi thay vì env_readings cho query thống kê theo ngày/tháng (nhanh hơn 100x)
- province_id là SMALLINT, không phải VARCHAR
- Tên tỉnh lưu bằng tiếng Việt có dấu: "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"
- Giới hạn kết quả tối đa LIMIT 50 để tránh quá tải
- Dữ liệu có từ năm 2023-2024, dùng NOW() - INTERVAL để lọc "gần đây"
"""

# ── 8 Few-shot Examples ─────────────────────────────────────────────────────────

FEW_SHOT_EXAMPLES = """
=== VÍ DỤ MẪU (few-shot) ===

[Q]: Tỉnh nào có AQI trung bình cao nhất trong 30 ngày qua?
[SQL]:
SELECT p.name AS province_name, ROUND(AVG(d.aqi_avg)::NUMERIC, 1) AS avg_aqi
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE d.day >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY avg_aqi DESC
LIMIT 10;

[Q]: PM2.5 trung bình tại Hà Nội tháng này là bao nhiêu?
[SQL]:
SELECT ROUND(AVG(d.pm2_5_avg)::NUMERIC, 2) AS pm25_avg
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE p.name ILIKE '%hà nội%'
  AND d.day >= DATE_TRUNC('month', NOW());

[Q]: So sánh AQI giữa Hà Nội và TP.HCM trong 7 ngày qua
[SQL]:
SELECT p.name, d.day, ROUND(d.aqi_avg::NUMERIC, 1) AS aqi
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE p.name ILIKE ANY(ARRAY['%hà nội%', '%hồ chí minh%', '%hcm%'])
  AND d.day >= NOW() - INTERVAL '7 days'
ORDER BY p.name, d.day;

[Q]: Có bao nhiêu lần đo PM2.5 vượt ngưỡng WHO (15 µg/m³) tuần này?
[SQL]:
SELECT COUNT(*) AS violations,
       p.name AS province_name
FROM env_readings e
JOIN provinces p ON p.id = e.province_id
WHERE e.pm2_5 > 15
  AND e.time >= NOW() - INTERVAL '7 days'
GROUP BY p.name
ORDER BY violations DESC
LIMIT 20;

[Q]: Xu hướng AQI của Đà Nẵng trong 14 ngày gần nhất
[SQL]:
SELECT d.day, ROUND(d.aqi_avg::NUMERIC, 1) AS aqi
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE p.name ILIKE '%đà nẵng%'
  AND d.day >= NOW() - INTERVAL '14 days'
ORDER BY d.day;

[Q]: Tỉnh nào vùng Bắc có AQI cao nhất hôm nay?
[SQL]:
SELECT p.name, ROUND(d.aqi_avg::NUMERIC, 1) AS aqi
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE p.region = 'Bắc'
  AND d.day = CURRENT_DATE
ORDER BY aqi DESC
LIMIT 5;

[Q]: AQI trung bình theo tháng của Hà Nội năm 2024
[SQL]:
SELECT DATE_TRUNC('month', d.day) AS month,
       ROUND(AVG(d.aqi_avg)::NUMERIC, 1) AS avg_aqi
FROM daily_aqi d
JOIN provinces p ON p.id = d.province_id
WHERE p.name ILIKE '%hà nội%'
  AND d.day >= '2024-01-01' AND d.day < '2025-01-01'
GROUP BY month
ORDER BY month;

[Q]: Top 5 giờ có PM2.5 cao nhất tại Bắc Ninh?
[SQL]:
SELECT e.time, e.pm2_5
FROM env_readings e
JOIN provinces p ON p.id = e.province_id
WHERE p.name ILIKE '%bắc ninh%'
  AND e.pm2_5 IS NOT NULL
ORDER BY e.pm2_5 DESC
LIMIT 5;
"""

# ── Intent Classification ───────────────────────────────────────────────────────

_INTENT_PROMPT = """Bạn là classifier phân loại câu hỏi về chất lượng không khí.
Phân loại câu hỏi người dùng vào MỘT trong 3 nhãn:
- "query": Câu hỏi cần truy vấn số liệu từ database (hỏi về AQI, PM2.5, so sánh tỉnh, xu hướng, v.v.)
- "analysis": Câu hỏi cần phân tích/giải thích dữ liệu không cần query SQL (hỏi về ý nghĩa chỉ số, giải thích kết quả, ...)
- "chitchat": Hỏi chào hỏi, câu hỏi không liên quan đến dữ liệu môi trường

Chỉ trả về đúng 1 từ: query | analysis | chitchat. Không giải thích gì thêm.

Câu hỏi: {question}"""


async def classify_intent(question: str) -> str:
    """Phân loại intent của câu hỏi người dùng."""
    model = _init_gemini()
    prompt = _INTENT_PROMPT.format(question=question)
    try:
        response = model.generate_content(prompt)
        intent = response.text.strip().lower()
        if intent not in ("query", "analysis", "chitchat"):
            intent = "query"   # fallback
        return intent
    except Exception as e:
        log.warning(f"classify_intent thất bại: {e}")
        return "query"


# ── Text2SQL Engine ─────────────────────────────────────────────────────────────

_SQL_SYSTEM_PROMPT = f"""Bạn là AirViz SQL Expert, chuyên sinh SQL PostgreSQL cho hệ thống quan trắc không khí.

{DB_SCHEMA}

{FEW_SHOT_EXAMPLES}

=== QUY TẮC BẮT BUỘC ===
1. Chỉ sinh câu SELECT — KHÔNG dùng INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE
2. Luôn có LIMIT (tối đa 50) nếu có thể trả về nhiều dòng
3. Dùng ILIKE '%...%' để tìm kiếm tên tỉnh không phân biệt hoa thường
4. Dùng daily_aqi view thay vì query trực tiếp env_readings khi hỏi về ngày/tháng
5. Xử lý NULL: WHERE column IS NOT NULL trước khi aggregate
6. Trả về SQL thuần túy trong block ```sql ... ```, KHÔNG giải thích gì thêm

Câu hỏi người dùng: {{question}}
Context dashboard hiện tại: {{context}}"""


def _extract_sql(text: str) -> str | None:
    """Trích xuất SQL từ response Gemini (nằm trong ```sql ... ```)."""
    # Tìm block ```sql ... ```
    pattern = r"```sql\s*([\s\S]+?)\s*```"
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Fallback: tìm SELECT trực tiếp
    select_match = re.search(r"(SELECT\s[\s\S]+?)(?:;|$)", text, re.IGNORECASE)
    if select_match:
        return select_match.group(1).strip() + ";"

    return None


def validate_sql(sql: str) -> tuple[bool, str]:
    """
    Kiểm tra SQL an toàn trước khi thực thi.
    Trả về (is_valid, error_message).
    """
    sql_upper = sql.upper().strip()

    # Từ chối các lệnh nguy hiểm
    FORBIDDEN = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
                 "TRUNCATE", "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE"]
    for keyword in FORBIDDEN:
        # Dùng \b để tránh match substring
        if re.search(rf"\b{keyword}\b", sql_upper):
            return False, f"SQL bị từ chối: lệnh '{keyword}' không được phép."

    # Phải bắt đầu bằng SELECT hoặc WITH
    if not re.match(r"^\s*(SELECT|WITH)\b", sql_upper):
        return False, "SQL không hợp lệ: chỉ hỗ trợ câu SELECT."

    # Không cho phép truy cập bảng nhạy cảm
    FORBIDDEN_TABLES = ["pg_user", "pg_shadow", "information_schema"]
    for tbl in FORBIDDEN_TABLES:
        if tbl.upper() in sql_upper:
            return False, f"SQL bị từ chối: truy cập bảng hệ thống '{tbl}'."

    return True, ""


async def generate_sql(
    question: str,
    context: dict | None = None,
    retry: int = 2,
) -> dict:
    """
    Sinh SQL từ câu hỏi tự nhiên. Retry tối đa `retry` lần nếu SQL sai.

    Returns:
        {
          "sql": str | None,
          "valid": bool,
          "error": str | None,
          "raw_response": str,
        }
    """
    model = _init_gemini()
    ctx_str = json.dumps(context or {}, ensure_ascii=False)
    prompt = _SQL_SYSTEM_PROMPT.format(question=question, context=ctx_str)

    last_error = ""
    for attempt in range(retry + 1):
        try:
            response = model.generate_content(prompt)
            raw = response.text.strip()

            sql = _extract_sql(raw)
            if not sql:
                last_error = "Không tìm thấy SQL trong response của AI."
                if attempt < retry:
                    prompt += f"\n\nLần trước không sinh được SQL hợp lệ. Hãy thử lại và chắc chắn đặt SQL trong block ```sql ... ```."
                continue

            is_valid, err = validate_sql(sql)
            if not is_valid:
                last_error = err
                if attempt < retry:
                    prompt += f"\n\nSQL vừa sinh bị từ chối vì: {err}. Hãy sửa lại."
                continue

            return {"sql": sql, "valid": True, "error": None, "raw_response": raw}

        except Exception as e:
            last_error = str(e)
            log.error(f"generate_sql attempt {attempt}: {e}")

    return {"sql": None, "valid": False, "error": last_error, "raw_response": ""}


# ── Direct Answer (analysis / chitchat) ────────────────────────────────────────

_DIRECT_PROMPT = """Bạn là AirViz AI, trợ lý phân tích chất lượng không khí Việt Nam.
Trả lời ngắn gọn, hữu ích bằng tiếng Việt. Bắt đầu mỗi câu trả lời bằng ✦.

Context dashboard hiện tại người dùng đang xem: {context}

Câu hỏi: {question}"""


async def answer_direct(question: str, context: dict | None = None) -> str:
    """Trả lời trực tiếp không cần SQL (analysis + chitchat)."""
    model = _init_gemini()
    ctx_str = json.dumps(context or {}, ensure_ascii=False)
    prompt = _DIRECT_PROMPT.format(question=question, context=ctx_str)
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if not text.startswith("✦"):
            text = "✦ " + text
        return text
    except Exception as e:
        log.error(f"answer_direct thất bại: {e}")
        return "✦ Xin lỗi, tôi không thể xử lý câu hỏi này lúc này. Vui lòng thử lại."
