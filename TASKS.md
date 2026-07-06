# 📋 AirViz.AI — Phân Công Nhiệm Vụ

> **Cập nhật lần cuối:** 06/07/2026  
> **Trạng thái dự án:** Hạ tầng ✅ | Dữ liệu ✅ | Backend API 🟡 | Frontend 🔴 | AI Chatbox 🔴

---

## ✅ Những gì đã XONG (Không cần làm lại)

| Hạng mục | Chi tiết |
|---|---|
| **Docker & Hạ tầng** | `docker-compose.yml` với 4 service: backend, timescaledb, redis, frontend |
| **Database schema** | Bảng `provinces`, `env_readings`, `ai_logs` đã được tạo |
| **Dữ liệu thô** | Đã nạp **1,388,016 dòng** dữ liệu từ CSV vào TimescaleDB |
| **Backend cơ bản** | FastAPI chạy được, Swagger UI ở `http://localhost:8080/docs` |
| **API Tổng quan** | `/dashboard/overview`, `/dashboard/map`, `/dashboard/trend`, `/dashboard/top-polluted` hoạt động |
| **Analytics backend** | Z-score anomaly detection & Pearson correlation đã có logic (`analytics_service.py`) |
| **Tab Tổng quan** | Đã có KPI cards, line chart xu hướng, top 5 tỉnh (`Overview.tsx`) |
| **README** | Hướng dẫn chạy dự án bằng tiếng Việt |

---

## 🔴 Những gì CẦN LÀM — Phân theo thành viên

---

### 👤 Thành viên 1 — Frontend: Tab Bản đồ
**File cần sửa:** `frontend/src/pages/MapView.tsx` *(hiện chỉ là placeholder)*

**Danh sách việc cần làm:**
- [ ] Tải file `vietnam.geojson` (GeoJSON 63 tỉnh) và đặt vào `frontend/public/`
  - Nguồn tham khảo: https://github.com/ThangLeQuoc/vietnamese-provinces-database
- [ ] Cài thư viện: `npm install leaflet react-leaflet @types/leaflet`
- [ ] Tạo component `VietnamMap.tsx` vẽ bản đồ choropleth (tô màu theo 6 mức AQI)
- [ ] Tô màu từng tỉnh theo giá trị AQI thật từ API `/dashboard/map`
  - 🟢 Tốt (0–50): `#00e400`
  - 🟡 Trung bình (51–100): `#ffff00`
  - 🟠 Không lành mạnh nhóm nhạy cảm (101–150): `#ff7e00`
  - 🔴 Không lành mạnh (151–200): `#ff0000`
  - 🟣 Rất không lành mạnh (201–300): `#8f3f97`
  - 🟤 Nguy hiểm (301+): `#7e0023`
- [ ] Click vào tỉnh → gọi API `/dashboard/province/{id}` → hiển thị panel chi tiết bên phải
- [ ] Thêm legend màu sắc AQI vào góc bản đồ
- [ ] Tooltip khi hover vào tỉnh: tên tỉnh + AQI hiện tại

---

### 👤 Thành viên 2 — Frontend: Tab Phân tích
**File cần sửa:** `frontend/src/pages/Analysis.tsx` *(hiện chỉ là placeholder)*

**Danh sách việc cần làm:**
- [ ] Cài thư viện: `npm install react-heatmap-grid`
- [ ] Dropdown chọn tỉnh + chọn metric (PM2.5, PM10, CO, NO₂, SO₂, O₃, Dust)
- [ ] Vẽ **Time-series chart** (Recharts `LineChart`) hiển thị xu hướng metric theo thời gian
- [ ] Vẽ **Histogram** phân phối giá trị AQI theo tháng
- [ ] Vẽ **Correlation Heatmap 7×7** bằng `react-heatmap-grid`:
  - Gọi API: `GET /api/v1/analytics/correlation?province_id=...&start_date=...&end_date=...`
  - Màu gradient: đỏ (tương quan âm) → trắng (0) → xanh (tương quan dương)
  - Hover vào ô → tooltip: *"PM2.5 và PM10 tương quan rất mạnh: r = 0.87"*
- [ ] Kết nối với Global Filter Store (Zustand) để filter tỉnh/thời gian đồng bộ toàn dashboard

---

### 👤 Thành viên 3 — Frontend: Tab So sánh & Tab Cảnh báo
**Files cần sửa:**
- `frontend/src/pages/Comparison.tsx` *(placeholder)*
- `frontend/src/pages/Alerts.tsx` *(placeholder)*

**Tab So sánh:**
- [ ] Multi-select tối đa 3 tỉnh cùng lúc
- [ ] Vẽ **Multi-line chart** so sánh AQI của các tỉnh trên cùng trục thời gian
- [ ] Vẽ **Radar chart** so sánh trung bình 7 biến giữa các tỉnh
- [ ] Bảng tổng hợp: min, max, trung bình, độ lệch chuẩn của từng tỉnh được chọn

**Tab Cảnh báo:**
- [ ] Gọi API: `GET /api/v1/analytics/anomalies?province_id=...&metric=pm2_5&threshold=2.5`
- [ ] Hiển thị **Line chart** với các điểm bất thường được đánh dấu màu đỏ (`ReferenceDot` của Recharts)
- [ ] Bảng danh sách bất thường:
  - Cột: Tỉnh | Thời điểm | Giá trị đo | Z-score | Mức độ
  - Badge: `|z| > 2.5` = ⚠️ Cao &nbsp; | &nbsp; `|z| > 3.5` = 🚨 Rất cao
- [ ] KPI card: Tổng số bất thường | Tỉnh có nhiều bất thường nhất
- [ ] Click vào một dòng bất thường → xem chi tiết 3 giờ trước và sau

---

### 👤 Thành viên 4 — Backend & Global State
**Files cần sửa/tạo:**
- `frontend/src/store/filterStore.ts`
- `frontend/src/store/chatStore.ts`
- `backend/app/cache/redis.py` *(file rỗng)*
- `backend/app/api/v1/dashboard.py` (thêm endpoint còn thiếu)

**Global Filter Store:**
- [ ] Tạo `frontend/src/store/filterStore.ts` (Zustand):
  - State: `selectedProvinces`, `dateRange`, `selectedMetric`
  - Khi thay đổi filter → tất cả chart trong app tự động refetch
- [ ] Tạo `frontend/src/store/chatStore.ts` (Zustand cho AI Chatbox)
- [ ] Gắn `GlobalFilterBar` vào Layout để hiển thị ở tất cả các tab

**WebSocket realtime:**
- [ ] Implement `GET /ws/realtime` trong backend phát AQI mới nhất mỗi 60 giây
- [ ] Tạo hook `frontend/src/hooks/useWebSocket.ts` để consume WebSocket
- [ ] Kết nối WebSocket vào bản đồ: màu tỉnh tự cập nhật không cần reload

**API còn thiếu:**
- [ ] `GET /dashboard/comparison` — So sánh nhiều tỉnh
  - Params: `province_ids` (list), `metric`, `start_date`, `end_date`
- [ ] Implement Redis cache trong `cache/redis.py` (hiện file rỗng)
  - Pattern: check cache → nếu miss → query DB → lưu cache → trả kết quả

---

### 👤 Thành viên 5 — AI Chatbox (Phase 4)
**Files cần sửa:**
- `backend/app/services/rag_service.py` *(file rỗng)*
- `backend/app/services/execution_service.py` *(file rỗng)*
- `backend/app/api/v1/ai.py` *(hiện là stub, trả response cứng)*

**Backend AI:**
- [ ] Tích hợp **Gemini 1.5 Flash API** vào `rag_service.py`
  - Thêm vào `.env`: `GEMINI_API_KEY=...`
  - Cài: `pip install google-generativeai`
- [ ] Viết **Intent Classifier**: phân loại câu hỏi → `query` | `analysis` | `codegen`
- [ ] Viết **Text2SQL Engine**:
  - System prompt inject schema DB và 8 few-shot examples
  - Validate SQL: chỉ cho phép `SELECT`, từ chối `INSERT/UPDATE/DELETE`
  - Retry tối đa 2 lần nếu SQL sai
- [ ] Viết `execution_service.py`: chạy code Python trong subprocess với timeout 30 giây
- [ ] Implement `ai_logs` service: ghi log đầy đủ vòng đời (pending → approved → executed)
- [ ] Wire RAG thật vào endpoint `POST /api/v1/ai/chat`

**Frontend Chatbox:**
- [ ] Tạo component `frontend/src/components/ai/ChatBox.tsx`
  - Floating button "Hỏi AI" ở góc phải màn hình
  - Mở modal overlay khi click
- [ ] Tạo `ChatThread.tsx`: render markdown response (`react-markdown`)
- [ ] Tạo `ApprovalPanel.tsx`: hiển thị SQL/code được sinh ra, nút **Approve** / **Reject**
- [ ] Tạo `ResultRenderer.tsx`: render kết quả (bảng dữ liệu, chart ảnh base64)
- [ ] State machine: `idle → loading → answered → pending_approval → executing → executed`
- [ ] Inject context dashboard vào chat: tỉnh đang xem, metric, khoảng thời gian

---

## 🛠️ Các việc chung — Ai rảnh thì làm

- [ ] Viết script `scripts/update_realtime.py` cập nhật dữ liệu mỗi 1 giờ
- [ ] Viết `docs/data-audit.md`: nguồn dữ liệu, số dòng trước/sau làm sạch
- [ ] Kiểm tra & xóa toàn bộ `console.log`, `print` debug trước khi nộp
- [ ] Chạy `EXPLAIN ANALYZE` trên các query nặng để đảm bảo < 1 giây
- [ ] Test tất cả endpoint trên Swagger UI (`http://localhost:8080/docs`)
- [ ] Soạn 5 câu hỏi vấn đáp mẫu và test thử trên chatbox AI

---

## ⚡ Thứ tự ưu tiên

```
🔴 Ưu tiên NGAY (ảnh hưởng trực tiếp điểm số):
   1. Tab Bản đồ (TTV 1) — trực quan nhất, chiếm điểm cao
   2. Global Filter Store (TTV 4) — cần xong trước khi test tích hợp
   3. Tab Cảnh báo - Anomaly (TTV 3) — kỹ thuật nổi bật nhất

🟡 Ưu tiên KẾ TIẾP:
   4. Tab Phân tích - Correlation Heatmap (TTV 2)
   5. Tab So sánh (TTV 3)
   6. AI Chatbox backend (TTV 5)

🟢 Làm sau cùng nếu còn thời gian:
   7. AI Chatbox frontend (TTV 5)
   8. WebSocket realtime (TTV 4)
   9. Cronjob cập nhật tự động
```

---

## 📌 Lưu ý quan trọng

> **Chạy hệ thống:** Mỗi lần bật máy cần chạy:
> ```bash
> docker compose up -d
> ```
> Frontend: `http://localhost:5173` | Backend API: `http://localhost:8080/docs`

> **Dữ liệu đã có sẵn** trong Docker Volume rồi — **KHÔNG cần chạy lại** script nạp dữ liệu.

> **KHÔNG hardcode** API key vào code — dùng file `.env`

> **KHÔNG push** thẳng vào nhánh `main` — tạo branch riêng (`feature/map-tab`, `feature/ai-chat`) rồi mở Pull Request.
