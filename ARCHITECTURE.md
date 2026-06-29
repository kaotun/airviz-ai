# AirViz.AI — System Architecture

**Hệ thống trực quan hóa và hỏi đáp thông minh chất lượng không khí Việt Nam**  
_Dashboard · AI Chatbox · RAG · Text2SQL · Human-in-the-loop_

---

## 0. Quyết định kiến trúc (ADR)

Trước khi đọc sơ đồ, cần hiểu tại sao các lựa chọn này được đưa ra.

| Quyết định | Lựa chọn | Lý do | Đánh đổi chấp nhận |
|---|---|---|---|
| DB chính | TimescaleDB | Time-series native, kế thừa REIS, `time_bucket` hiệu quả | Nặng hơn SQLite, cần Docker |
| LLM | Gemini 1.5 Flash | Free tier đủ dùng, context window lớn (1M token) | Latency cao hơn local model |
| RAG strategy | Text2SQL (không vector store) | Dữ liệu có cấu trúc rõ, schema ổn định — không cần embed | Không xử lý được câu hỏi về tài liệu phi cấu trúc |
| Frontend | React + Recharts + Leaflet | Ecosystem lớn, GeoJSON VN có sẵn | Bundle size lớn hơn Svelte |
| Execution sandbox | Subprocess + timeout | Đơn giản, không cần Docker-in-Docker | Không cách ly hoàn toàn ở mức OS |
| Cache | Redis | TTL linh hoạt, pub/sub cho realtime | Thêm một service cần quản lý |
| State chatbox | FSM (Finite State Machine) | Trạng thái approval rõ ràng, tránh bug logic | Phức tạp hơn boolean flag |

---

## 1. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER                                                         │
│  ┌─────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Dashboard (5 tabs)     │   │  AI Chatbox (popup/modal)    │  │
│  │  React + Recharts       │   │  FSM: idle→loading→          │  │
│  │  Leaflet choropleth     │   │       pending→executed       │  │
│  └────────────┬────────────┘   └──────────────┬───────────────┘  │
└───────────────┼──────────────────────────────-┼──────────────────┘
                │ REST / WebSocket               │ REST
┌───────────────▼────────────────────────────────▼──────────────────┐
│  API GATEWAY — FastAPI (async)                                     │
│                                                                    │
│  /api/v1/dashboard/*   →  DataService                             │
│  /api/v1/ai/chat       →  RAGService                              │
│  /api/v1/ai/execute    →  ExecutionService                        │
│  /api/v1/logs/*        →  LogService                              │
│  ws://…/realtime       →  WebSocketManager                        │
└──────┬─────────────┬──────────────┬────────────────┬──────────────┘
       │             │              │                │
┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌──────▼──────┐
│ TimescaleDB │ │  Redis   │ │ RAG Engine │ │  Exec       │
│ (primary)   │ │  Cache   │ │ (LLM core) │ │  Sandbox    │
└─────────────┘ └──────────┘ └────────────┘ └─────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  DATA SCIENCE & AI RESEARCH (notebooks/)                         │
│  01_data_collection → 02_eda_vietnam_aqi → 03_anomaly_detection  │
│  04_llm_text2sql_prototyping (Gemini RAG/AI Chatbox testing)     │
└──────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc thiết kế:**
- Mỗi service có một trách nhiệm duy nhất (SRP)
- Không có logic nghiệp vụ ở tầng API Gateway — chỉ route và validate
- Tất cả side-effect (thực thi code, ghi log) đều qua service riêng, không inline trong handler

---

## 2. Data Layer

### 2.1 Schema

```sql
-- Bảng chính — hypertable theo cột time
CREATE TABLE env_readings (
    time            TIMESTAMPTZ     NOT NULL,
    province_id     SMALLINT        NOT NULL REFERENCES provinces(id),
    aqi             NUMERIC(6,2),
    pm25            NUMERIC(6,2),   -- μg/m³
    pm10            NUMERIC(6,2),   -- μg/m³
    temperature     NUMERIC(5,2),   -- °C
    humidity        NUMERIC(5,2),   -- %
    wind_speed      NUMERIC(5,2),   -- km/h
    wind_direction  NUMERIC(5,2),   -- độ (0–360)
    pressure        NUMERIC(7,2),   -- hPa
    uv_index        NUMERIC(4,2),
    is_anomaly      BOOLEAN         DEFAULT FALSE,
    PRIMARY KEY (time, province_id)
);

SELECT create_hypertable('env_readings', 'time', chunk_time_interval => INTERVAL '7 days');
CREATE INDEX ON env_readings (province_id, time DESC);

-- Lookup tỉnh/thành
CREATE TABLE provinces (
    id       SMALLINT PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    slug     VARCHAR(100) NOT NULL UNIQUE,  -- dùng cho Text2SQL
    region   VARCHAR(10)  NOT NULL CHECK (region IN ('north','central','south')),
    lat      NUMERIC(8,5),
    lon      NUMERIC(8,5)
);

-- Log mọi vòng đời yêu cầu AI
CREATE TABLE ai_logs (
    id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID            NOT NULL,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    user_request     TEXT            NOT NULL,
    intent           VARCHAR(50),    -- 'query' | 'analysis' | 'codegen'
    generated_sql    TEXT,
    generated_code   TEXT,
    edited_code      TEXT,           -- sau khi người dùng chỉnh sửa
    approved_at      TIMESTAMPTZ,
    execution_result JSONB,          -- {type, data, error}
    status           VARCHAR(20)     NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','executed','rejected','error'))
);
```

### 2.2 Continuous Aggregate (tối ưu query dashboard)

```sql
-- Pre-compute AQI trung bình theo ngày — tránh full scan mỗi request
CREATE MATERIALIZED VIEW daily_aqi
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    province_id,
    AVG(aqi)    AS avg_aqi,
    MAX(aqi)    AS max_aqi,
    AVG(pm25)   AS avg_pm25,
    COUNT(*)    AS reading_count
FROM env_readings
GROUP BY bucket, province_id;

ADD CONTINUOUS AGGREGATE POLICY daily_aqi (
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
```

### 2.3 Caching strategy

```
Request → Redis.get(cache_key)
    HIT  → trả về ngay (TTL còn hạn)
    MISS → query TimescaleDB → Redis.set(cache_key, result, ttl=300s) → trả về

Cache key pattern: airviz:{endpoint}:{params_hash}
TTL theo loại data:
  - Realtime AQI      → 60s
  - Daily aggregate   → 300s
  - Static (provinces)→ 3600s
```

---

## 3. API Layer

### 3.1 Endpoint contract

```
GET  /api/v1/dashboard/overview
     → {national_avg_aqi, provinces_over_threshold, anomaly_count, trend_7d[]}

GET  /api/v1/dashboard/map
     → {provinces: [{id, name, lat, lon, aqi, level}]}

GET  /api/v1/dashboard/timeseries?province_id=&metric=&from=&to=
     → {labels: [], values: []}

GET  /api/v1/dashboard/ranking?limit=10&order=desc
     → {provinces: [{rank, name, aqi, pm25, trend}]}

GET  /api/v1/dashboard/compare?ids=1,2,3&metric=aqi&from=&to=
     → {series: [{province, data: []}]}

GET  /api/v1/alerts?status=active&limit=20
     → {alerts: [{province, metric, value, threshold, detected_at}]}

POST /api/v1/ai/chat
     body: {session_id, message, context?: {province_id?, metric?, date_range?}}
     → {intent, response_text, code?, explanation?, requires_approval: bool}

POST /api/v1/ai/execute
     body: {log_id, code}   ← code đã được người dùng duyệt
     → {result_type, data, chart_base64?, error?}

GET  /api/v1/logs?session_id=&limit=50
     → {logs: [ai_logs record]}

WS   /ws/realtime
     → emit every 60s: {province_id, aqi, pm25, timestamp}
```

### 3.2 Error response chuẩn

```json
{
  "error": {
    "code": "SQL_GENERATION_FAILED",
    "message": "Không thể tạo truy vấn từ câu hỏi này. Vui lòng diễn đạt lại.",
    "request_id": "uuid",
    "retryable": true
  }
}
```

---

## 4. RAG Engine

### 4.1 Pipeline

```
User message
    │
    ▼
┌─────────────────┐
│ Intent Classifier│  Prompt: few-shot classification
│                 │  Output: "query" | "analysis" | "codegen"
└────────┬────────┘
         │
   ┌─────┴──────┬─────────────┐
   ▼            ▼             ▼
[query]    [analysis]    [codegen]
   │            │             │
   ▼            ▼             ▼
Text2SQL    Insight      Code Generator
   │        Generator        │
   ▼            │             ▼
Run SQL     Augment      Return code
   │        with result  + explanation
   ▼            │        (NO execution)
Result      Natural lang      │
   └────────────┴─────────────┘
                │
                ▼
        Response Builder
        (format + log)
```

### 4.2 Text2SQL — Prompt design

```
System prompt inject các thông tin sau:
  1. Schema đầy đủ của env_readings + provinces (tên cột, kiểu dữ liệu, ý nghĩa)
  2. 5 dòng dữ liệu mẫu thật từ DB
  3. Mapping tên tỉnh tiếng Việt → slug trong DB
  4. Các query mẫu (few-shot): 8–10 ví dụ hỏi → SQL
  5. Constraint bắt buộc:
     - Chỉ SELECT, không INSERT/UPDATE/DELETE
     - Luôn có LIMIT nếu không aggregate
     - Luôn filter time trong 90 ngày gần nhất nếu không chỉ định
```

### 4.3 Validation trước khi execute SQL

```python
# Các check bắt buộc trước khi chạy SQL do LLM sinh ra
checks = [
    is_select_only(sql),          # Từ chối nếu có DML
    no_drop_or_truncate(sql),     # Bảo vệ dữ liệu
    has_time_filter(sql),         # Tránh full scan
    tables_exist(sql, allowed),   # Chỉ query table đã whitelist
]
if not all(checks):
    raise SQLValidationError(...)
```

### 4.4 Code generation — Human-in-the-loop

```
LLM sinh code → Frontend nhận → Trạng thái "pending_approval"
                                      │
                              Người dùng xem xét
                              (có thể sửa tham số)
                                      │
                    ┌─────────────────┼───────────────────┐
                    ▼                 ▼                   ▼
               Approve            Reject              Edit → Approve
                    │                 │
                    ▼                 ▼
           POST /api/v1/ai/execute  Log rejected
           (kèm log_id + code)
                    │
                    ▼
           ExecutionService chạy
           trong subprocess timeout=30s
```

---

## 5. Frontend Architecture

### 5.1 Cấu trúc component

```
App
├── Layout
│   ├── Topbar (logo, nav tabs, nút "Hỏi AI")
│   └── Sidebar (filter toàn cục: tỉnh, thời gian)
├── Pages
│   ├── Overview      (KPIGrid, TrendChart, AlertBanner)
│   ├── MapView       (LeafletMap, ProvinceDetailPanel)
│   ├── Analysis      (MetricSelector, TimeSeriesChart, CorrelationHeatmap)
│   ├── Compare       (ProvinceMultiSelect, MultiLineChart, RadarChart)
│   └── Alerts        (AlertTable, AnomalyBadge)
└── ChatBox (global, portal render)
    ├── ChatThread    (MessageList, CodeBlock, ResultRenderer)
    ├── ApprovalPanel (CodeEditor, ApproveBtn, RejectBtn)
    └── ChatInput
```

### 5.2 Chatbox State Machine

```
         open()
idle ──────────────► loading
 ▲                      │
 │          response     │
 │    ┌─────────────────┤
 │    ▼                 │
 │  answered        code_generated
 │    │                 │
 │    │ new msg    pending_approval
 │    │                 │
 │    └──────►  ┌───────┴────────┐
 │           approve          reject
 │              │                │
 │           executing        answered
 │              │
 │           executed ──────────────► answered
 │                                       │
 └───────────────────────────────────────┘
```

### 5.3 Data fetching strategy

```
Dashboard data    → TanStack Query, staleTime=60s, refetch on window focus
Realtime AQI      → WebSocket, update React state trực tiếp (không qua Query cache)
AI chat           → Local state trong ChatBox component (không cache)
Static (provinces)→ TanStack Query, staleTime=Infinity (không đổi)
```

---

## 6. Deployment

```yaml
# docker-compose.yml — một lệnh chạy toàn bộ
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [timescaledb, redis]

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    volumes: ["pgdata:/var/lib/postgresql/data"]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  seed:
    build: ./backend
    command: python scripts/seed.py
    depends_on: [timescaledb]
    profiles: ["init"]   # chỉ chạy 1 lần khi setup

volumes:
  pgdata:
```

**Lưu ý:** Execution sandbox chạy như subprocess trong container `backend`, không mount volume nào ngoài `/tmp/sandbox` — không thể đọc/ghi file hệ thống.

---

## 7. Non-functional Requirements

| NFR | Target | Cách đo |
|---|---|---|
| Dashboard load | < 2s | Lighthouse Performance score |
| AI chat response | < 5s (p95) | Log timestamp từ request đến response |
| SQL execution | < 1s | TimescaleDB `EXPLAIN ANALYZE` |
| Uptime trong demo | 100% | Chạy thử 30 phút liên tục trước ngày vấn đáp |
| Dữ liệu đề yêu cầu | ≥ 2000 dòng, ≥ 7 biến | `SELECT COUNT(*), COUNT(DISTINCT column)` |

---

## 8. Constraints từ đề bài (bắt buộc)

| Constraint | Hiện thực hóa trong thiết kế |
|---|---|
| AI không tự thực thi code | `ExecutionService` chỉ nhận request sau khi `ai_logs.status = 'approved'` |
| AI không tự thay đổi dữ liệu gốc | SQL validation từ chối mọi DML; execution sandbox không có write access vào DB |
| Code phải hiển thị rõ trước khi chạy | Frontend bắt buộc render `CodeBlock` + `ApprovalPanel` trước khi gọi `/execute` |
| Lưu trữ toàn bộ lịch sử | Bảng `ai_logs` ghi đủ: request → intent → SQL/code → edited → approved → result |
| Thực thi trên môi trường local | Toàn bộ chạy qua Docker Compose local, không deploy lên cloud |
