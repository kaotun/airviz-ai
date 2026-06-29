# AirViz Data Science & AI Research

Thư mục này chứa các Jupyter Notebooks mô phỏng quy trình nghiên cứu Khoa học dữ liệu và thử nghiệm AI (LLM) dành riêng cho bài toán chất lượng không khí tại Việt Nam của dự án AirViz.

## Cấu trúc Notebooks

- **`01_data_collection_openmeteo.ipynb`**: Thử nghiệm và thu thập dữ liệu lịch sử từ API Open-Meteo cho 63 tỉnh thành. Dùng để hiểu cấu trúc JSON trả về và xây dựng logic cho script `crawl_openmeteo.py`.
- **`02_eda_vietnam_aqi.ipynb`**: Phân tích khám phá dữ liệu (EDA) chất lượng không khí tại Việt Nam. Trực quan hóa phân phối PM2.5 theo vùng miền (Bắc/Trung/Nam), phân tích tính mùa vụ, và đánh giá mối tương quan giữa nhiệt độ, độ ẩm với nồng độ bụi mịn.
- **`03_anomaly_detection.ipynb`**: Xây dựng và thử nghiệm thuật toán phát hiện bất thường (Anomaly Detection) trong chuỗi thời gian AQI. Thuật toán này sẽ là cốt lõi cho chức năng hiển thị Cảnh báo (Alerts) trên Dashboard khi có đợt ô nhiễm đột biến.
- **`04_llm_text2sql_prototyping.ipynb`**: Môi trường thử nghiệm prompt engineering cho Gemini 1.5 Flash. Thử nghiệm việc dịch các câu hỏi tự nhiên tiếng Việt (VD: "Tỉnh nào ô nhiễm nhất hôm qua?") thành câu truy vấn SQL (Text2SQL) tương thích với cấu trúc của TimescaleDB, chuẩn bị cho tính năng AI Chatbox.

## Cách sử dụng

Bạn có thể mở và chạy các notebook này trong quá trình nghiên cứu, tinh chỉnh thuật toán trước khi đem tích hợp chính thức vào Backend (FastAPI).
1. Kích hoạt môi trường ảo: `.\.venv\Scripts\activate`
2. Cài đặt các thư viện Data Science (nếu chưa có): `pip install jupyterlab pandas matplotlib seaborn scikit-learn`
3. Chạy lệnh: `jupyter lab` và điều hướng đến thư mục này.
