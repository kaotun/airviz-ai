# AirViz.AI — Project Phases

**Nhóm 4–5 người · Mô hình làm việc: feature branch → PR → main**  
_Mỗi phase kết thúc bằng một deliverable có thể demo được, không phải chỉ "code xong"._

---

## Quy ước chung

- **Definition of Done (DoD):** Một task chỉ "xong" khi: chạy được, không crash, đã test thủ công, đã commit lên branch.
- **Branch strategy:** `main` luôn chạy được. Mỗi phase làm trên branch riêng (`phase/1-data`, `phase/2-backend`...), merge vào main khi phase hoàn thành.
- **Không build trên nền giả định:** Nếu phase trước chưa xong, phase sau không bắt đầu phần phụ thuộc.
- **Ưu tiên vertical slice:** Mỗi phase ra một luồng end-to-end nhỏ hoạt động được, không phải toàn bộ tính năng ở mức skeleton.

---

## Phase 0 — Project Setup & Baseline _(0.5–1 ngày)_

### Mục tiêu
Toàn nhóm có môi trường phát triển đồng nhất, không mất thời gian debug "chạy trên máy tao nhưng không chạy trên máy mày".

### Công việc

- Khởi tạo monorepo: `frontend/`, `backend/`, `scripts/`, `docs/`
- Viết `docker-compose.yml` với đủ 4 service: frontend, backend, timescaledb, redis
- Cấu hình `.env.example` với tất cả biến môi trường cần thiết
- Viết `Makefile` với các lệnh shortcut: `make up`, `make down`, `make seed`, `make lint`
- Cài đặt linter/formatter: `ruff` + `black` cho Python, `eslint` + `prettier` cho React
- Tạo GitHub repo, thiết lập branch protection cho `main`
- Xác nhận: tất cả thành viên `git clone` → `make up` → thấy được trang trắng của frontend và `{"status":"ok"}` từ backend

### Tiêu chí hoàn thành

- [ ] `docker-compose up` chạy không lỗi trên máy của tất cả thành viên
- [ ] CI cơ bản: lint pass trên mọi PR
- [ ] `.env.example` đầy đủ, không hardcode secret trong code
- [ ] README có hướng dẫn setup từ đầu cho người mới

---

## Phase 1 — Data Foundation _(2–3 ngày)_

### Mục tiêu
Tự thu thập dữ liệu từ Open-Meteo API cho 63 tỉnh thành Việt Nam, lưu vào TimescaleDB sạch, đủ chuẩn đề bài, với các query phục vụ dashboard chạy dưới 1 giây.

### Công việc

**1.1 Thiết kế kế hoạch thu thập dữ liệu**
- Xác định danh sách 63 tỉnh/thành với tọa độ GPS (latitude, longitude) → lưu vào `scripts/provinces.json`
- Xác định các biến cần thu thập từ Open-Meteo Air Quality API:
  - `pm2_5`, `pm10`, `carbon_monoxide`, `nitrogen_dioxide`, `sulphur_dioxide`, `ozone`, `dust`
  - `european_aqi` hoặc tính toán AQI từ các chỉ số trên
- Xác định khoảng thời gian historical: lấy **ít nhất 1 năm** gần nhất (đủ để có dữ liệu theo mùa)
- Output: `docs/data-plan.md` ghi rõ danh sách biến, endpoint, khoảng thời gian, và ước tính số dòng

**1.2 Thiết kế schema cuối cùng**
- Viết migration SQL tạo `env_readings`, `provinces`, `ai_logs`
- Tạo hypertable, index, continuous aggregate `daily_aqi`
- Không thay đổi schema sau phase này nếu không có lý do rất chính đáng

**1.3 Script thu thập dữ liệu historical**
- Viết `scripts/crawl_openmeteo.py`:
  - Gọi endpoint `/v1/air-quality` với params: `latitude`, `longitude`, `hourly`, `start_date`, `end_date`
  - Batch 63 tỉnh theo thứ tự, sleep 100ms giữa mỗi request để tránh rate limit
  - Parse JSON response → `pandas.DataFrame` → insert batch vào TimescaleDB
  - Retry tự động tối đa 3 lần nếu request thất bại
  - Log tiến trình: tỉnh nào xong, bao nhiêu dòng đã insert
- Chạy `make seed` để thu thập toàn bộ dữ liệu lịch sử lần đầu

**1.4 Làm sạch và chuẩn hóa**
- Drop duplicate theo `(province_id, time)`
- Impute NULL theo chính sách rõ ràng: interpolate linear nếu gap < 3 giờ, drop nếu gap lớn hơn
- Tính `aqi_calculated` từ PM2.5 và PM10 theo công thức chuẩn US EPA nếu API không trả về AQI trực tiếp
- Ghi toàn bộ chính sách xử lý vào `docs/data-audit.md`

**1.5 Cronjob cập nhật realtime**
- Viết script `scripts/update_realtime.py` chạy mỗi **1 giờ**:
  - Gọi Open-Meteo cho 63 tỉnh với `forecast_days=1` để lấy dữ liệu giờ gần nhất
  - Upsert vào DB (insert or update on conflict)
- Tích hợp với `apscheduler` trong backend hoặc cron container

**1.6 Verify**
- Chạy `EXPLAIN ANALYZE` trên 5 query dashboard điển hình, đảm bảo không có Seq Scan trên bảng lớn

### Kỹ thuật sử dụng

- **Open-Meteo Air Quality API**: endpoint `/v1/air-quality`, params `hourly`, `start_date`, `end_date` — hoàn toàn miễn phí, không cần API key
- TimescaleDB: `create_hypertable`, `time_bucket`, continuous aggregate, `chunk_time_interval`
- SQL: window function, CTE, partial index
- Python: `httpx`/`aiohttp` async cho batch crawl, `pandas` cho ETL, `asyncpg` cho insert batch
- Rate limiting: exponential backoff, sleep giữa các request

### Tiêu chí hoàn thành

- [ ] `SELECT COUNT(*) FROM env_readings` trả về ≥ 2000
- [ ] Có đủ ≥ 7 cột đo lường không NULL quá 5%
- [ ] Dữ liệu trải dài ≥ 6 tháng, đủ 63 tỉnh
- [ ] Query aggregation 30 ngày toàn quốc chạy < 1s (dùng `daily_aqi` view)
- [ ] Script `make seed` chạy idempotent (chạy nhiều lần không lỗi, không duplicate)
- [ ] `data-audit.md` ghi rõ: nguồn Open-Meteo, danh sách biến, chính sách xử lý NULL, số dòng trước/sau làm sạch
- [ ] Cronjob update chạy được và đã insert ít nhất 1 batch mới sau khi seed xong

---

## Phase 2 — Backend API _(3–4 ngày)_

### Mục tiêu
Toàn bộ API phục vụ dashboard và chatbox hoạt động đúng, có contract rõ ràng, có thể test độc lập bằng Swagger UI.

### Công việc

**2.1 Cấu trúc FastAPI**

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── dashboard.py   (routes)
│   │   ├── analytics.py   (routes: anomalies, correlation)
│   │   ├── ai.py          (routes)
│   │   └── logs.py        (routes)
│   ├── services/
│   │   ├── data_service.py
│   │   ├── analytics_service.py  ← Z-score + Pearson correlation
│   │   ├── rag_service.py
│   │   ├── execution_service.py
│   │   └── log_service.py
│   ├── db/
│   │   ├── queries.py     (raw SQL, không ORM)
│   │   └── connection.py  (async pool)
│   ├── cache/
│   │   └── redis.py
│   └── models/
│       └── schemas.py     (Pydantic models)
```

**2.2 Dashboard endpoints**
- Implement đủ 6 endpoint theo contract trong ARCHITECTURE.md
- Mỗi endpoint đi qua: validate params → check Redis cache → query DB (nếu cache miss) → set cache → trả về
- Không có business logic trong route handler — chỉ gọi service

**2.3 Analytics endpoints (Z-score + Correlation)**
- `GET /api/v1/analytics/anomalies` — phát hiện bất thường bằng **Rolling Z-score 7 ngày**
  - Params: `province_id`, `metric` (pm2_5/pm10/...), `threshold` (mặc định 2.5)
  - Response: danh sách `{time, value, z_score, province_id}` vượt ngưỡng
  - Logic: rolling window 168h (7 ngày × 24h), điểm có `|z| > threshold` → bất thường
- `GET /api/v1/analytics/correlation` — ma trận tương quan Pearson 7 biến
  - Params: `province_id` (optional, nếu bỏ trống → tính toàn quốc), `start_date`, `end_date`
  - Response: matrix `7×7` với giá trị Pearson r `[-1, 1]`
  - Dùng `pandas.DataFrame.corr(method='pearson')`
- Cache TTL: anomalies = 30 phút, correlation = 6 giờ (ít thay đổi)

**2.4 WebSocket realtime**
- `/ws/realtime`: emit dữ liệu AQI mới nhất mỗi 60 giây
- Dùng `asyncio` + `broadcast` hoặc Redis pub/sub nếu cần multi-worker

**2.5 AI endpoints (stub trước)**
- `POST /api/v1/ai/chat` → trả về response cứng (dummy) để frontend làm việc song song
- `POST /api/v1/ai/execute` → chạy code đơn giản, log kết quả
- RAG thật sẽ wire vào ở Phase 4

**2.6 Log service**
- Mọi request vào `/ai/*` đều tạo một record trong `ai_logs` ngay khi nhận
- Update record qua các trạng thái: pending → approved → executed
- `GET /api/v1/logs` trả về lịch sử có pagination

**2.7 Error handling**
- Global exception handler: mọi exception đều trả về format `{"error": {"code", "message", "retryable"}}`
- Không để stack trace lộ ra response production

### Kỹ thuật sử dụng

- FastAPI: `APIRouter`, `Depends`, `BackgroundTasks`, `WebSocket`, lifespan event
- asyncpg: connection pool, prepared statement cho query lặp lại
- Pydantic v2: strict mode, `model_validator` cho business validation
- Redis: `aioredis`, cache-aside pattern, TTL phân tầng theo loại data
- Python: `asyncio`, `subprocess` với timeout cho execution sandbox
- **Analytics**: `pandas` rolling window, `scipy.stats` cho Z-score; `pandas.DataFrame.corr` cho Pearson
- Testing: `pytest` + `httpx.AsyncClient` cho API test, fixture cho DB test

### Tiêu chí hoàn thành

- [ ] Tất cả endpoint dashboard trả đúng dữ liệu, Swagger UI test pass
- [ ] `GET /analytics/anomalies` trả về danh sách đúng, có `z_score` field
- [ ] `GET /analytics/correlation` trả về ma trận 7×7, giá trị trong [-1, 1]
- [ ] WebSocket emit đúng, kết nối được từ browser devtools
- [ ] Mọi lỗi đều trả về format chuẩn, không lộ stack trace
- [ ] Cache hoạt động: request thứ 2 cùng params phải nhanh hơn request đầu ít nhất 5x
- [ ] `ai_logs` ghi đúng record với đủ các field, update đúng status
- [ ] Có ít nhất 5 API test tự động pass

---

## Phase 3 — Dashboard Frontend _(4–5 ngày)_

### Mục tiêu
5 tab dashboard hiển thị dữ liệu thật, đáp ứng đủ 7 tiêu chí đánh giá của đề bài, giao diện đủ đẹp để demo.

### Công việc

**3.1 Cấu trúc thư mục frontend**

```
frontend/
├── public/
│   ├── vietnam.geojson        (GeoJSON 63 tỉnh cho Leaflet)
│   └── favicon.ico
├── src/
│   ├── api/
│   │   ├── client.ts          (Axios instance, interceptor lỗi toàn cục)
│   │   ├── dashboard.ts       (gọi các endpoint dashboard)
│   │   ├── ai.ts              (gọi AI chat, execute)
│   │   └── logs.ts            (gọi AI logs)
│   ├── components/
│   │   ├── common/
│   │   │   ├── KPICard.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── AlertBanner.tsx
│   │   ├── charts/
│   │   │   ├── AQILineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── Heatmap.tsx
│   │   │   ├── RadarChart.tsx
│   │   │   └── Histogram.tsx
│   │   ├── map/
│   │   │   ├── VietnamMap.tsx  (Leaflet choropleth)
│   │   │   └── ProvincePanel.tsx
│   │   ├── filter/
│   │   │   ├── GlobalFilterBar.tsx
│   │   │   ├── ProvinceSelect.tsx
│   │   │   └── DateRangePicker.tsx
│   │   └── ai/
│   │       ├── ChatBox.tsx
│   │       ├── ChatThread.tsx
│   │       ├── ApprovalPanel.tsx
│   │       └── ResultRenderer.tsx
│   ├── pages/
│   │   ├── Overview.tsx       (Tab Tổng quan)
│   │   ├── MapView.tsx        (Tab Bản đồ)
│   │   ├── Analysis.tsx       (Tab Phân tích)
│   │   ├── Comparison.tsx     (Tab So sánh)
│   │   └── Alerts.tsx         (Tab Cảnh báo)
│   ├── store/
│   │   ├── filterStore.ts     (Zustand: selectedProvinces, dateRange, selectedMetric)
│   │   └── chatStore.ts       (Zustand: conversation history, FSM state)
│   ├── hooks/
│   │   ├── useDashboardData.ts
│   │   ├── useWebSocket.ts
│   │   └── useAQIColor.ts     (map AQI value → color theo chuẩn)
│   ├── utils/
│   │   ├── aqi.ts             (tính toán, phân loại AQI)
│   │   ├── formatters.ts      (format số, ngày tháng tiếng Việt)
│   │   └── constants.ts       (AQI thresholds, color palette)
│   ├── types/
│   │   └── index.ts           (TypeScript interfaces cho API response)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .eslintrc.json
├── .prettierrc
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**3.2 Setup frontend**
- React + Vite + TypeScript, TanStack Query, Zustand (global filter state), React Router v6
- Axios instance với base URL, interceptor xử lý lỗi toàn cục
- Tailwind CSS, cấu hình color palette theo chuẩn AQI (xanh/vàng/cam/đỏ/tím/nâu đỏ)

**3.2 Global filter (quan trọng)**
- Zustand store: `{selectedProvinces, dateRange, selectedMetric}`
- Tất cả chart subscribe vào store này — thay đổi filter tự động update toàn bộ dashboard
- Đây là điểm thể hiện "sự tích hợp và liên kết" trong tiêu chí đánh giá

**3.3 Tab Tổng quan**
- 4 KPI card: AQI trung bình, PM2.5, số tỉnh vượt ngưỡng, số bất thường
- Line chart xu hướng AQI 7 ngày (Recharts, responsive)
- Alert banner nếu có tỉnh AQI > 150
- Top 5 tỉnh ô nhiễm nhất (bar chart nằm ngang)

**3.4 Tab Bản đồ**
- Leaflet choropleth với GeoJSON Việt Nam 63 tỉnh
- Tô màu theo 6 mức AQI chuẩn quốc tế
- Click vào tỉnh → panel chi tiết bên phải (AQI, PM2.5, nhiệt độ, độ ẩm hiện tại)
- Cập nhật màu realtime qua WebSocket (không reload page)

**3.5 Tab Phân tích**
- Dropdown chọn metric và chọn tỉnh
- Time-series chart với zoom/pan (Recharts `ReferenceArea` hoặc `recharts-zoom`)
- Histogram phân phối AQI theo tháng
- **Correlation Heatmap 7×7** — gọi `GET /analytics/correlation`, render bằng D3 hoặc `react-heatmap-grid`
  - Màu sắc: gradient đỏ (tương quan âm) → trắng (0) → xanh (tương quan dương)
  - Hover vào ô → tooltip hiển thị giá trị Pearson r và ý nghĩa (VD: "PM2.5 và PM10 tương quan rất mạnh: r = 0.87")
  - Filter theo tỉnh/toàn quốc + date range từ global filter store

**3.6 Tab So sánh**
- Multi-select tối đa 3 tỉnh
- Multi-line chart cùng trục thời gian
- Radar chart so sánh trung bình các biến
- Bảng tổng hợp: min, max, mean, stddev cho từng tỉnh

**3.7 Tab Cảnh báo**
- **Z-score Anomaly Detection** — gọi `GET /analytics/anomalies`
  - Mỗi điểm bất thường hiển thị: tỉnh, thời điểm, giá trị đo, z-score, mức độ (Cao/Rất cao)
  - Line chart với các điểm bất thường được đánh dấu bằng `ReferenceDot` màu đỏ (Recharts)
  - Bảng danh sách với badge mức độ (`|z| > 2.5` = Cao, `|z| > 3.5` = Rất cao), filter theo tỉnh
  - Mỗi row expand → xem context 3 giờ trước và 3 giờ sau điểm bất thường
  - KPI card: tổng số bất thường trong kỳ, tỉnh có nhiều bất thường nhất

### Kỹ thuật sử dụng

- React: `useMemo` và `useCallback` đúng chỗ (tránh re-render không cần thiết)
- TanStack Query: `useQuery`, `useQueries`, `staleTime`, `refetchInterval`
- Recharts: `ComposedChart`, `ResponsiveContainer`, `ReferenceDot` (đánh dấu anomaly), custom tooltip
- Leaflet + react-leaflet: `GeoJSON`, `choropleth`, `Popup`, `Tooltip`
- Zustand: global filter store, slice pattern
- **Correlation Heatmap**: `react-heatmap-grid` hoặc D3 custom — gradient màu phân kỳ
- **Anomaly markers**: `ReferenceDot` trên Recharts line chart, màu đỏ với z-score trong tooltip
- Nguyên tắc trực quan hóa: đúng loại chart cho từng dữ liệu (bar cho so sánh, line cho trend, heatmap cho tương quan)

### Tiêu chí hoàn thành

- [ ] Cả 5 tab load được dữ liệu thật từ API, không còn mock data
- [ ] Thay đổi filter global → tất cả chart update đồng bộ
- [ ] Bản đồ tô màu đúng, click vào tỉnh hiện đúng dữ liệu tỉnh đó
- [ ] WebSocket cập nhật màu bản đồ mà không reload
- [ ] **Correlation heatmap** hiển thị đúng, hover tooltip có giá trị r và nhận xét
- [ ] **Anomaly markers** xuất hiện đúng trên line chart, bảng có badge mức độ
- [ ] Không có console error trong trạng thái bình thường
- [ ] Giao diện hiển thị đúng ở độ phân giải 1920×1080 và 1366×768

---

## Phase 4 — AI Chatbox & RAG Engine _(5–6 ngày)_

### Mục tiêu
Chatbox AI hoạt động end-to-end: nhận câu hỏi tiếng Việt → query DB → trả lời/sinh code → người dùng duyệt → thực thi → hiển thị kết quả. Tuân thủ đúng hướng dẫn `ai-guide-v2`.

### Công việc

**4.1 RAG Engine — Intent Classifier**
- Viết prompt few-shot phân loại intent: `query` | `analysis` | `codegen`
- Test với ≥ 20 câu hỏi mẫu, đạt accuracy ≥ 90%
- Fallback: nếu không classify được → hỏi lại người dùng, không đoán

**4.2 RAG Engine — Text2SQL**
- Thiết kế system prompt: inject schema + dữ liệu mẫu + mapping tên tỉnh + 8 few-shot examples
- Validate SQL trước khi execute: whitelist table, từ chối DML, kiểm tra time filter
- Retry logic: nếu SQL lỗi syntax → gửi error message cho LLM, yêu cầu sửa (tối đa 2 lần retry)
- Test với ≥ 15 dạng câu hỏi, log tất cả SQL được sinh ra để review

**4.3 RAG Engine — Code Generator**
- Prompt yêu cầu LLM sinh code Python kèm comment giải thích từng bước bằng tiếng Việt
- Code phải: import đủ thư viện, sử dụng `df` variable từ context (data đã query), output là chart hoặc bảng
- Không inject dữ liệu nhạy cảm vào prompt (chỉ schema và sample, không toàn bộ dataset)

**4.4 Execution Service**
- Nhận code đã approved, chạy trong subprocess với:
  - Timeout: 30 giây
  - Memory limit (ulimit trong Linux hoặc resource limit)
  - Working directory: `/tmp/sandbox/{log_id}` — xóa sau khi chạy xong
- Capture stdout, stderr, và file output (PNG chart)
- Encode chart thành base64 để trả về frontend
- Ghi kết quả vào `ai_logs.execution_result` (JSONB)

**4.5 Chatbox Frontend**
- Implement State Machine: `idle → loading → answered / pending_approval → executing → executed`
- ChatThread: render markdown (`react-markdown`), syntax highlight code (`prism-react-renderer`)
- ApprovalPanel: hiển thị code + explanation, CodeMirror editor để sửa inline, nút Approve/Reject
- ResultRenderer: render chart (base64 img), dataframe (React table), hoặc text
- Lưu conversation history trong local state (không persist, mất khi reload — acceptable)
- Floating button "Hỏi AI" ở góc phải, mở modal overlay

**4.6 Context awareness**
- Khi mở chatbox từ một tab dashboard cụ thể → inject context (tỉnh đang xem, metric đang chọn, date range) vào request
- Ví dụ: đang xem bản đồ tỉnh Hà Nội → chatbox tự hiểu ngữ cảnh là Hà Nội

### Kỹ thuật sử dụng

- LLM: Gemini 1.5 Flash API, prompt engineering, few-shot learning, chain-of-thought cho SQL phức tạp
- RAG pattern: context injection (không vector store — data có cấu trúc)
- Python: `subprocess`, `resource`, `tempfile`, `base64`, `io.StringIO`
- React: FSM pattern với `useReducer`, `createPortal` cho modal
- `react-markdown` + `remark-gfm`: render markdown response
- `prism-react-renderer`: syntax highlight Python code
- CodeMirror 6: inline code editor trong ApprovalPanel

### Tiêu chí hoàn thành

- [ ] Intent classifier đạt ≥ 90% accuracy trên 20 câu test
- [ ] Text2SQL sinh SQL hợp lệ cho ≥ 15 dạng câu hỏi khác nhau
- [ ] SQL validation từ chối đúng các câu có DML hoặc thiếu time filter
- [ ] Code sinh ra có comment tiếng Việt giải thích từng bước
- [ ] Trạng thái "Chờ phê duyệt" hiển thị rõ, không thể bỏ qua
- [ ] Execution chỉ chạy sau khi có approved_at trong `ai_logs`
- [ ] Chart/bảng kết quả hiển thị đúng trong chat sau khi chạy
- [ ] Toàn bộ vòng đời được ghi đầy đủ trong `ai_logs`
- [ ] Context từ dashboard được inject đúng vào chatbox

---

## Phase 5 — Integration, Hardening & Demo Prep _(2–3 ngày)_

### Mục tiêu
Hệ thống chạy ổn định end-to-end 30 phút không crash. Nhóm tự tin demo và trả lời vấn đáp.

### Công việc

**5.1 Integration testing**
- Chạy toàn bộ user journey: mở dashboard → xem bản đồ → mở chatbox → hỏi câu hỏi số liệu → hỏi sinh code → chỉnh sửa → approve → xem kết quả
- Fix tất cả lỗi tích hợp giữa frontend và backend
- Kiểm tra WebSocket hoạt động khi để màn hình idle 10 phút

**5.2 Edge case hardening**
- Chatbox: câu hỏi không liên quan đến dữ liệu môi trường → từ chối lịch sự
- Chatbox: LLM trả về SQL sai 3 lần → hiển thị thông báo lỗi, không crash
- Dashboard: API timeout → hiển thị skeleton + retry button, không màn trắng
- Execution: code chạy quá 30s → timeout, thông báo rõ

**5.3 Performance check**
- Đo thực tế: dashboard overview load trong bao nhiêu giây, AI response trong bao nhiêu giây
- Nếu chậm: xác định bottleneck (DB? Redis miss? LLM latency?) và fix có mục tiêu

**5.4 Chuẩn bị vấn đáp**
- Soạn ≥ N câu hỏi phân tích (N = số thành viên), test thử trước bằng chatbox
- Chuẩn bị câu trả lời cho các câu hỏi khó dự đoán:
  - "AI trong hệ thống của bạn đóng vai trò gì, con người kiểm soát ở đâu?"
  - "Tại sao chọn Text2SQL thay vì vector store?"
  - "Nếu LLM sinh SQL sai thì hệ thống xử lý thế nào?"
  - "Dữ liệu của bạn đảm bảo tin cậy không, nguồn từ đâu?"

**5.5 Báo cáo AI summary (yêu cầu của đề)**
- Tóm tắt quá trình dùng AI: những yêu cầu đã đặt ra, kết quả nhận được, những thay đổi đã thực hiện, nhận xét về AI
- Lấy dữ liệu từ bảng `ai_logs` để minh chứng bằng con số thật

**5.6 Final cleanup**
- Xóa tất cả console.log, print debug trong production code
- Đảm bảo `.env.example` cập nhật đủ biến
- README đủ để TA setup và chạy được trong 15 phút

### Tiêu chí hoàn thành

- [ ] Demo liên tục 30 phút không có lỗi crash hoặc màn trắng
- [ ] Tất cả N câu hỏi vấn đáp đã được test chạy thành công trên chatbox
- [ ] `docker-compose up` trên máy clean (chưa có gì) chạy thành công trong < 5 phút
- [ ] Báo cáo có phần AI summary đầy đủ với số liệu từ `ai_logs`
- [ ] Không còn hardcode API key, secret, localhost URL trong code

---

## Phân công nhóm 4–5 người

| Thành viên | Phase chính | Phase hỗ trợ | Ghi chú |
|---|---|---|---|
| A — Data | Phase 0, 1 | Phase 2 (DB queries) | Làm xong sớm → sang hỗ trợ Phase 3 data |
| B — Backend | Phase 2 | Phase 4 (RAG backend), Phase 5 | Owner của API contract |
| C — Frontend | Phase 3 | Phase 4 (Chatbox UI), Phase 5 | Owner của component structure |
| D — AI/RAG | Phase 4 | Phase 2 (AI stub endpoint) | Bắt đầu thiết kế prompt từ Phase 1 |
| E — Lead/QA | Phase 0, 5 | Review tất cả phase | Không làm feature — review, tích hợp, fix bug |

**Lưu ý:** Thành viên D nên bắt đầu thiết kế và thử nghiệm prompt Text2SQL từ Phase 1 (khi đã có DB), không chờ đến Phase 4 mới bắt đầu.

---

## Dependency giữa các phase

```
Phase 0 ──────────────────────────────────────► Phase 5
   │
   ▼
Phase 1 (DB + data)
   │
   ├──► Phase 2 (Backend API)
   │         │
   │         ├──► Phase 3 (Dashboard) ─────────► Phase 5
   │         │
   │         └──► Phase 4 (RAG + Chatbox) ──────► Phase 5
   │
   └──► Phase 4 bắt đầu thiết kế prompt (song song với Phase 2)
```

Phase 3 và Phase 4 có thể làm song song sau khi Phase 2 xong stub endpoint.

---

## Risk Register

| Rủi ro | Xác suất | Mức độ | Kế hoạch xử lý |
|---|---|---|---|
| LLM sinh SQL sai thường xuyên | Cao | Cao | Đầu tư vào few-shot examples từ sớm; có retry logic; test từ Phase 1 khi đã có DB |
| Gemini API latency > 5s | Trung bình | Trung bình | Thêm loading indicator; cache response cho câu hỏi giống nhau |
| Dữ liệu REIS không đủ chuẩn | Thấp | Cao | Audit ngay từ đầu Phase 1; có kế hoạch crawl bổ sung |
| Bản đồ GeoJSON VN không đủ chi tiết | Thấp | Thấp | Test GeoJSON từ sớm ở Phase 3; backup: dùng thư viện `vietmap` |
| Phase 4 kéo dài vượt kế hoạch | Cao | Cao | Ưu tiên Text2SQL và Chatbox UI trước; Code generation là nice-to-have |
| Execution sandbox bị khai thác | Thấp | Cao | Whitelist import, timeout 30s, chạy với user không có quyền ghi DB |
