# AirViz.AI

> Nền tảng trực quan hóa dữ liệu full-stack và trợ lý AI giám sát chất lượng không khí theo thời gian thực trên toàn Việt Nam.

![Tech Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20TimescaleDB%20%7C%20Redis-blue)
![Data Source](https://img.shields.io/badge/data-Open--Meteo%20API-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📌 Tổng quan

AirViz.AI thu thập dữ liệu chất lượng không khí hàng giờ của 63 tỉnh thành Việt Nam qua **Open-Meteo Air Quality API**, lưu trữ vào cơ sở dữ liệu chuỗi thời gian **TimescaleDB**, và hiển thị qua một Dashboard tương tác với 5 góc nhìn phân tích. Hệ thống tích hợp **Trợ lý AI** mạnh mẽ bằng mô hình Gemini 1.5 Flash, cho phép người dùng truy vấn dữ liệu bằng ngôn ngữ tự nhiên thông qua kỹ thuật Text2SQL RAG với cơ chế kiểm duyệt của con người.

## 🚀 Tính năng nổi bật

- 📊 **Dashboard tương tác 5 tab** — Tổng quan, Bản đồ, Phân tích, So sánh, Cảnh báo.
- 🗺️ **Bản đồ nhiệt (Choropleth map)** — Hiển thị chỉ số AQI trực tiếp trên bản đồ 63 tỉnh thành.
- 🤖 **Trợ lý AI Chatbox** — Dịch ngôn ngữ tự nhiên sang SQL + Sinh code vẽ biểu đồ (có bước người dùng xác nhận).
- ⚡ **Cập nhật theo thời gian thực** — Làm mới dữ liệu trực tiếp qua WebSockets.
- 🔍 **Bộ lọc toàn cầu** — Đồng bộ hóa bộ lọc thời gian và địa điểm trên tất cả các biểu đồ.

## 🛠️ Công nghệ sử dụng

| Lớp (Layer) | Công nghệ |
|---|---|
| **Frontend** | React + Vite + TypeScript, TanStack Query, Zustand, Recharts, Leaflet |
| **Backend** | FastAPI, asyncpg, APScheduler |
| **Cơ sở dữ liệu** | TimescaleDB (PostgreSQL), Redis |
| **AI** | Gemini 1.5 Flash, Text2SQL RAG |
| **Nguồn dữ liệu** | Open-Meteo Air Quality API (miễn phí, không cần API key) |
| **Triển khai** | Docker Compose |

## 🚀 Hướng dẫn chạy nhanh (Windows / Docker)

Yêu cầu: Máy tính đã cài đặt và bật phần mềm **Docker Desktop**.

```bash
# 1. Bật toàn bộ hệ thống
docker compose up -d --build

# 2. Bơm dữ liệu thời tiết vào Database (Chỉ chạy 1 lần duy nhất lúc khởi tạo)
docker compose exec backend python /scripts/crawl_openmeteo.py --start 2024-01-01 --end 2026-07-06

# 3. Xem kết quả trên trình duyệt
# -> Giao diện web (Frontend): http://localhost:5173
# -> API Backend (Swagger UI): http://localhost:8080/docs

# 4. Tắt hệ thống khi nghỉ ngơi (để giải phóng RAM)
docker compose down
```

## 📁 Cấu trúc dự án

```text
airviz-ai/
├── backend/        # Mã nguồn FastAPI
├── frontend/       # Mã nguồn React + Vite
├── notebooks/      # Môi trường phân tích Khoa học Dữ liệu (EDA) và thử nghiệm AI
├── scripts/        # Các đoạn script cào và tiền xử lý dữ liệu
├── data/           # Các file JSON cấu hình, GeoJSON bản đồ và dataset thô
├── docs/           # Tài liệu lưu trữ quyết định kiến trúc và kiểm định dữ liệu
├── docker-compose.yml
└── Makefile
```

## 🔐 Biến môi trường

Vui lòng xem file [`.env.example`](.env.example) để biết danh sách các biến môi trường cần thiết cho dự án.

## 📚 Tài liệu tham khảo

- [Kiến trúc hệ thống (Architecture)](ARCHITECTURE.md)
- [Các giai đoạn phát triển (Phases)](PHASES.md)
- [Kế hoạch thu thập dữ liệu](docs/data-plan.md)
- [Nhật ký kiểm định dữ liệu (Audit Log)](docs/data-audit.md)
