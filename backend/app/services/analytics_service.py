"""
analytics_service.py
--------------------
Cung cấp 2 tính năng phân tích thống kê:
  1. Z-score Anomaly Detection  — phát hiện bất thường bằng rolling window 7 ngày
  2. Pearson Correlation Matrix — ma trận tương quan 7 biến môi trường
"""

import numpy as np
import pandas as pd

# ── Constants ─────────────────────────────────────────────────────────────────

# 7 biến đo lường (thứ tự cố định cho correlation matrix)
MEASURE_COLS = [
    "pm2_5",
    "pm10",
    "carbon_monoxide",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "ozone",
    "dust",
]

# Tên hiển thị tiếng Việt (dùng cho tooltip frontend)
MEASURE_LABELS = {
    "pm2_5":            "Bụi mịn PM2.5",
    "pm10":             "Bụi mịn PM10",
    "carbon_monoxide":  "Carbon Monoxide (CO)",
    "nitrogen_dioxide": "Nitrogen Dioxide (NO₂)",
    "sulphur_dioxide":  "Sulphur Dioxide (SO₂)",
    "ozone":            "Ozone (O₃)",
    "dust":             "Bụi thô",
}

# Rolling window 7 ngày × 24 giờ
ROLLING_WINDOW_HOURS = 168

# Ngưỡng phân loại mức độ bất thường
THRESHOLD_HIGH      = 2.5
THRESHOLD_VERY_HIGH = 3.5


# ── Z-score Anomaly Detection ─────────────────────────────────────────────────

def detect_anomalies(
    df: pd.DataFrame,
    metric: str = "pm2_5",
    threshold: float = THRESHOLD_HIGH,
) -> list[dict]:
    """
    Phát hiện bất thường bằng Rolling Z-score.

    Args:
        df:        DataFrame với cột `time`, `province_id`, và các cột đo lường.
                   Phải được sort theo time tăng dần.
        metric:    Tên cột cần phân tích (mặc định: pm2_5).
        threshold: Ngưỡng |z| để coi là bất thường (mặc định: 2.5σ).

    Returns:
        Danh sách dict, mỗi dict là một điểm bất thường:
        {time, province_id, value, z_score, severity}
    """
    if metric not in df.columns:
        raise ValueError(f"Metric '{metric}' không tồn tại. Chọn một trong: {MEASURE_COLS}")

    series = df[metric].copy()

    # Rolling mean và std trên cửa sổ 168 giờ
    rolling_mean = series.rolling(window=ROLLING_WINDOW_HOURS, min_periods=24).mean()
    rolling_std  = series.rolling(window=ROLLING_WINDOW_HOURS, min_periods=24).std()

    # Tránh chia cho 0 khi std = 0 (dữ liệu không đổi)
    rolling_std = rolling_std.replace(0, np.nan)

    z_scores = (series - rolling_mean) / rolling_std
    df = df.copy()
    df["z_score"] = z_scores

    # Lọc các điểm vượt ngưỡng
    anomaly_mask = df["z_score"].abs() > threshold
    anomalies_df = df[anomaly_mask].copy()

    if anomalies_df.empty:
        return []

    results = []
    for _, row in anomalies_df.iterrows():
        z = float(row["z_score"])
        results.append({
            "time":        row["time"].isoformat() if hasattr(row["time"], "isoformat") else str(row["time"]),
            "province_id": int(row["province_id"]),
            "metric":      metric,
            "value":       _safe_float(row.get(metric)),
            "z_score":     round(z, 3),
            "severity":    "very_high" if abs(z) > THRESHOLD_VERY_HIGH else "high",
        })

    # Sort theo z_score giảm dần (bất thường nhất lên đầu)
    results.sort(key=lambda x: abs(x["z_score"]), reverse=True)
    return results


def get_anomaly_context(
    df: pd.DataFrame,
    anomaly_time: pd.Timestamp,
    metric: str,
    context_hours: int = 3,
) -> dict:
    """
    Lấy context xung quanh một điểm bất thường (±context_hours giờ).
    Dùng để hiển thị khi người dùng expand một row trong bảng cảnh báo.

    Returns:
        {before: [...], anomaly: {...}, after: [...]}
    """
    mask_before = (df["time"] >= anomaly_time - pd.Timedelta(hours=context_hours)) & \
                  (df["time"] < anomaly_time)
    mask_after  = (df["time"] >  anomaly_time) & \
                  (df["time"] <= anomaly_time + pd.Timedelta(hours=context_hours))

    def row_to_dict(row):
        return {
            "time":  row["time"].isoformat(),
            "value": _safe_float(row.get(metric)),
        }

    return {
        "before":  [row_to_dict(r) for _, r in df[mask_before].iterrows()],
        "anomaly": {
            "time":  anomaly_time.isoformat(),
            "value": _safe_float(df[df["time"] == anomaly_time][metric].iloc[0]) if not df[df["time"] == anomaly_time].empty else None,
        },
        "after":   [row_to_dict(r) for _, r in df[mask_after].iterrows()],
    }


# ── Pearson Correlation Matrix ────────────────────────────────────────────────

def compute_correlation(df: pd.DataFrame) -> dict:
    """
    Tính ma trận tương quan Pearson cho 7 biến đo lường.

    Args:
        df: DataFrame với các cột đo lường (subset của MEASURE_COLS).

    Returns:
        {
          "labels":  ["pm2_5", "pm10", ...],          # 7 tên biến
          "display": ["Bụi mịn PM2.5", ...],          # tên hiển thị tiếng Việt
          "matrix":  [[1.0, 0.87, ...], ...],          # ma trận 7×7
          "sample_size": 8760                          # số dòng dùng để tính
        }
    """
    # Lọc ra các cột đo lường có trong DataFrame
    available_cols = [c for c in MEASURE_COLS if c in df.columns]
    if len(available_cols) < 2:
        raise ValueError("Cần ít nhất 2 cột đo lường để tính tương quan.")

    # Drop hàng có quá nhiều NULL (giữ hàng có ít nhất 4/7 biến hợp lệ)
    subset = df[available_cols].dropna(thresh=max(2, len(available_cols) // 2))

    if len(subset) < 30:
        raise ValueError(f"Không đủ dữ liệu để tính tương quan (chỉ có {len(subset)} dòng hợp lệ).")

    corr_matrix = subset.corr(method="pearson")

    # Chuyển thành list 2D, làm tròn 3 chữ số thập phân
    matrix = []
    for col in available_cols:
        row = []
        for col2 in available_cols:
            val = corr_matrix.loc[col, col2]
            row.append(round(float(val), 3) if not np.isnan(val) else None)
        matrix.append(row)

    return {
        "labels":      available_cols,
        "display":     [MEASURE_LABELS.get(c, c) for c in available_cols],
        "matrix":      matrix,
        "sample_size": len(subset),
    }


def describe_correlation(r: float) -> str:
    """
    Mô tả ngắn gọn mức độ tương quan bằng tiếng Việt.
    Dùng để render tooltip trên heatmap.
    """
    abs_r = abs(r)
    direction = "dương" if r > 0 else "âm"
    if abs_r >= 0.9:
        strength = "rất mạnh"
    elif abs_r >= 0.7:
        strength = "mạnh"
    elif abs_r >= 0.5:
        strength = "trung bình"
    elif abs_r >= 0.3:
        strength = "yếu"
    else:
        strength = "rất yếu hoặc không có"

    if abs_r < 0.1:
        return f"Tương quan {strength} (r = {r:.2f})"
    return f"Tương quan {direction} {strength} (r = {r:.2f})"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(val) -> float | None:
    try:
        f = float(val)
        return None if np.isnan(f) else round(f, 4)
    except (TypeError, ValueError):
        return None
