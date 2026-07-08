# Kế hoạch Thu thập Dữ liệu — AirViz

## 1. Nguồn dữ liệu

| Mục | Chi tiết |
|---|---|
| **Nguồn chính** | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) |
| **Geocoding** | [OpenStreetMap Nominatim API](https://nominatim.openstreetmap.org/) |
| **Chi phí** | Hoàn toàn miễn phí, không cần API key |
| **Giấy phép** | Open Data Commons Open Database License (ODbL) |

---

## 2. Phạm vi Thu thập

| Mục | Giá trị |
|---|---|
| **Địa lý** | 63 tỉnh thành Việt Nam |
| **Khoảng thời gian** | 2024-01-01 → 2024-12-31 (1 năm đầy đủ) |
| **Độ phân giải thời gian** | Hourly (theo giờ) |
| **Ước tính số dòng** | 63 tỉnh × 8,760 giờ ≈ **552,000 dòng** |

---

## 3. Biến Thu thập (8 biến độc lập)

| Tên biến | Đơn vị | Mô tả | Nguồn |
|---|---|---|---|
| `pm2_5` | µg/m³ | Bụi mịn PM2.5 (hạt < 2.5µm) | Open-Meteo |
| `pm10` | µg/m³ | Bụi thô PM10 (hạt < 10µm) | Open-Meteo |
| `carbon_monoxide` | µg/m³ | Carbon Monoxide (CO) | Open-Meteo |
| `nitrogen_dioxide` | µg/m³ | Nitrogen Dioxide (NO₂) | Open-Meteo |
| `sulphur_dioxide` | µg/m³ | Sulphur Dioxide (SO₂) | Open-Meteo |
| `ozone` | µg/m³ | Ozone tầng thấp (O₃) | Open-Meteo |
| `dust` | µg/m³ | Bụi sa mạc / bụi thô tự nhiên | Open-Meteo |
| `european_aqi` | 0–500+ | Chỉ số AQI châu Âu (tổng hợp từ các chỉ số trên) | Open-Meteo |

**Biến bổ sung (metadata):**

| Tên biến | Mô tả |
|---|---|
| `province` | Tên tỉnh thành |
| `code` | Mã tỉnh (01–64) |
| `region` | Vùng miền: `north` / `central` / `south` |
| `latitude` / `longitude` | Tọa độ GPS lấy từ OpenStreetMap |
| `time` | Timestamp theo múi giờ Asia/Ho_Chi_Minh |

---

## 4. Endpoint API

### Open-Meteo Air Quality API
```
GET https://air-quality-api.open-meteo.com/v1/air-quality
    ?latitude={lat}
    &longitude={lon}
    &hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,european_aqi
    &start_date=2024-01-01
    &end_date=2024-12-31
    &timezone=Asia/Ho_Chi_Minh
```

### OpenStreetMap Nominatim (Geocoding)
```
GET https://nominatim.openstreetmap.org/search
    ?q={province_name}, Vietnam
    &format=json
    &limit=1
```

---

## 5. Chiến lược Thu thập

- **Geocoding**: Crawl tọa độ 1 lần duy nhất → lưu vào `data/meta/provinces.json` (dữ liệu tĩnh, không crawl lại).
- **Dữ liệu lịch sử**: Gọi API từng tỉnh, mỗi tỉnh 1 request, sleep 0.15s giữa các request để không bị rate limit.
- **Retry**: Tự động thử lại tối đa 3 lần với exponential backoff (2s, 4s) nếu request lỗi.
- **Output**: Lưu toàn bộ ra file `data/raw/vietnam_air_quality_dataset.csv` (~50MB).

---

## 6. Tiêu chí Chấp nhận Dữ liệu

- [ ] Có đủ 63 tỉnh thành
- [ ] Khoảng thời gian ít nhất 6 tháng
- [ ] Tổng số dòng ≥ 10,000
- [ ] Tỷ lệ NULL mỗi cột < 10%
- [ ] Không có duplicate theo `(province, time)`
