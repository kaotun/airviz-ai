# Data Audit — AirViz.AI

## Nguồn dữ liệu

| Mục | Chi tiết |
|---|---|
| **Nguồn** | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) |
| **Endpoint** | `https://air-quality-api.open-meteo.com/v1/air-quality` |
| **Chi phí** | Miễn phí, không cần API key |
| **Script thu thập** | `scripts/crawl_openmeteo.py` |
| **Tần suất cập nhật** | Mỗi 1 giờ (qua `scripts/update_realtime.py`) |

---

## Phạm vi dữ liệu

| Mục | Giá trị |
|---|---|
| **Địa lý** | 63 tỉnh thành Việt Nam |
| **Khoảng thời gian** | 2024-01-01 → 2026-06-25 |
| **Độ phân giải thời gian** | Hourly (theo giờ) |
| **Tổng số dòng (sau làm sạch)** | ~1,372,000+ |

---

## Biến thu thập (8 biến)

| Tên biến | Đơn vị | Mô tả |
|---|---|---|
| `pm2_5` | µg/m³ | Bụi mịn PM2.5 |
| `pm10` | µg/m³ | Bụi mịn PM10 |
| `carbon_monoxide` | µg/m³ | Carbon Monoxide (CO) |
| `nitrogen_dioxide` | µg/m³ | Nitrogen Dioxide (NO₂) |
| `sulphur_dioxide` | µg/m³ | Sulphur Dioxide (SO₂) |
| `ozone` | µg/m³ | Ozone (O₃) |
| `dust` | µg/m³ | Bụi thô (Dust) |
| `european_aqi` | 0–500+ | Chỉ số AQI châu Âu (tổng hợp) |

---

## Chính sách xử lý dữ liệu

### Duplicate
- **Chính sách:** `ON CONFLICT (time, province_id) DO UPDATE` — upsert idempotent
- **Kết quả:** Không có duplicate trong bảng `env_readings`

### NULL values
- **Nguyên nhân:** Open-Meteo đôi khi không có dữ liệu cho một số giờ nhất định
- **Xử lý:**
  - Gap ≤ 3 giờ liên tiếp → **Interpolate tuyến tính** (`pandas.interpolate(method='linear', limit=3)`)
  - Gap > 3 giờ → **Giữ nguyên NULL** (không impute dữ liệu xa)
- **Ngưỡng chấp nhận:** Cột có NULL < 5% → coi là hợp lệ

### Đơn vị
- Tất cả biến nồng độ giữ nguyên đơn vị gốc từ API (µg/m³)
- `european_aqi` là chỉ số tổng hợp, không có đơn vị vật lý

---

## Kết quả làm sạch

| Mục | Số liệu |
|---|---|
| Tỉnh thu thập thành công | 63 / 63 |
| Script crawl | `crawl_openmeteo.py` |
| Thời gian crawl | ~10 phút (toàn bộ) |
| Lần crawl lại (retry) | 3 tỉnh (Đồng Nai, Lai Châu, Quảng Ngãi) do rate limit |

---

## Schema

Xem chi tiết tại [`backend/app/db/migrations/001_init.sql`](../backend/app/db/migrations/001_init.sql)

Bảng chính: `env_readings` (hypertable TimescaleDB, chunk theo tháng)
View tổng hợp: `daily_aqi` (continuous aggregate, cập nhật mỗi 1 giờ)
