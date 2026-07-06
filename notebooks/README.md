# AirViz — Data Science & AI Research

Thư mục này chứa các Jupyter Notebooks mô phỏng quy trình nghiên cứu Khoa học dữ liệu và thử nghiệm AI dành riêng cho bài toán chất lượng không khí tại Việt Nam của dự án AirViz.

## Cấu trúc Notebooks

| File | Mô tả |
|---|---|
| **`00_api_exploration.ipynb`** | Khám phá API sơ khởi: thử nghiệm Mapbox Geocoding và Open-Meteo, hiểu cấu trúc JSON trả về trước khi xây dựng pipeline chính thức. |
| **`01_data_collection.ipynb`** | Thu thập dữ liệu không khí lịch sử (hourly, 1 năm) cho 63 tỉnh thành từ Open-Meteo Air Quality API. Geocoding tọa độ bằng OpenStreetMap (không cần API key). Xuất ra `data/vietnam_air_quality_dataset.csv`. |
| **`02_data_preprocessing.ipynb`** | Tiền xử lý và làm sạch dữ liệu: kiểm tra và xử lý giá trị NULL, chuẩn hóa kiểu dữ liệu, thêm cột phân vùng (Bắc/Trung/Nam), loại bỏ outlier bất hợp lý. Xuất ra `data/vietnam_aqi_cleaned.csv`. |
| **`03_exploratory_data_analysis.ipynb`** | Phân tích khám phá dữ liệu (EDA): phân phối PM2.5 theo vùng miền, phân tích xu hướng theo tháng/mùa, ma trận tương quan Pearson giữa 8 chỉ số, top tỉnh ô nhiễm nhất. |

## Thứ tự chạy

```
00_api_exploration  (tham khảo, không bắt buộc)
        ↓
01_data_collection  → tạo ra data/vietnam_air_quality_dataset.csv
        ↓
02_data_preprocessing → tạo ra data/vietnam_aqi_cleaned.csv
        ↓
03_exploratory_data_analysis → tạo ra các biểu đồ và phân tích
```

## Cách sử dụng

1. Kích hoạt môi trường ảo: `.\.venv\Scripts\activate`
2. Cài đặt thư viện: `pip install jupyter pandas matplotlib seaborn requests`
3. Mở Jupyter: `jupyter notebook` hoặc dùng VS Code với extension Jupyter
4. Chạy theo thứ tự từ trên xuống dưới

> **Lưu ý:** Notebook `01_data_collection` cần kết nối Internet để gọi API. Thời gian chạy ước tính ~15 phút do giới hạn tốc độ của OpenStreetMap (1.2s/tỉnh × 63 tỉnh).
