import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from '../../api/dashboard';
import { useFilterStore } from '../../store/filterStore';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts';

import {
  C, glassCard, monoFont, headFont, DarkTooltip, SectionHeader,
} from '../../utils/dashboardConstants';
import TabFilterBar from '../TabFilterBar';

const METRIC_LABELS = {
  pm2_5: 'PM2.5',
  pm10: 'PM10',
  carbon_monoxide: 'CO',
  nitrogen_dioxide: 'NO₂',
  sulphur_dioxide: 'SO₂',
  ozone: 'O₃',
  dust: 'Dust',
};

function unwrapProvinces(mapData) {
  if (Array.isArray(mapData)) return mapData;
  return mapData?.provinces ?? [];
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function formatChartTime(isoStr) {
  const d = new Date(isoStr);
  return !isNaN(d.getTime()) ? `${d.getDate()}/${d.getMonth() + 1}` : isoStr;
}

function severityLabel(severity) {
  return severity === 'very_high' ? 'Rất cao' : 'Cao';
}

function severityColor(severity) {
  return severity === 'very_high' ? C.danger : C.warning;
}

function getContextWindow(anomalies, selectedTime, hours = 3) {
  const center = new Date(selectedTime).getTime();
  const ms = hours * 3600 * 1000;
  return anomalies.filter(a => {
    const t = new Date(a.time).getTime();
    return t >= center - ms && t <= center + ms;
  }).sort((a, b) => new Date(a.time) - new Date(b.time));
}

const AlertsTab = () => {
  const { selectedProvinces, selectedMetric, startDate, endDate } = useFilterStore();
  const selectedProvinceId = selectedProvinces[0]?.id;
  const selectedProvinceName = selectedProvinces[0]?.name;
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);

  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData(),
  });

  const provinceNameMap = useMemo(() => {
    const map = {};
    unwrapProvinces(mapData).forEach(p => { map[p.province_id] = p.province_name; });
    return map;
  }, [mapData]);

  const { data: anomalyData, isLoading, isError } = useQuery({
    queryKey: ['anomalies', selectedProvinceId, selectedMetric, startDate, endDate],
    queryFn: () => analyticsApi.getAnomalies({
      province_id: selectedProvinceId ?? undefined,
      metric: selectedMetric,
      threshold: 2.5,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const { data: trendData } = useQuery({
    queryKey: ['trend', startDate, endDate, selectedProvinceId],
    queryFn: () => dashboardApi.getTrend(startDate, endDate, selectedProvinceId ?? undefined),
    enabled: !!selectedProvinceId,
  });

  const anomalies = anomalyData?.anomalies ?? [];
  const metricLabel = METRIC_LABELS[selectedMetric] ?? selectedMetric;

  const topProvince = useMemo(() => {
    if (anomalies.length === 0) return null;
    const counts = {};
    for (const a of anomalies) {
      counts[a.province_id] = (counts[a.province_id] || 0) + 1;
    }
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topId) return null;
    return {
      name: provinceNameMap[Number(topId[0])] || `Tỉnh ${topId[0]}`,
      count: topId[1],
    };
  }, [anomalies, provinceNameMap]);

  const maxZScore = useMemo(() => {
    if (anomalies.length === 0) return null;
    return anomalies.reduce((max, a) => Math.abs(a.z_score) > Math.abs(max.z_score) ? a : max, anomalies[0]);
  }, [anomalies]);

  // Line chart: ưu tiên trend AQI nếu có tỉnh được chọn, fallback từ anomalies
  const chartData = useMemo(() => {
    const trendPoints = trendData?.data ?? (Array.isArray(trendData) ? trendData : []);
    if (trendPoints.length > 0) {
      return trendPoints.map(t => ({
        time: t.date,
        displayTime: formatChartTime(t.date),
        value: t.aqi,
      }));
    }
    if (anomalies.length > 0) {
      return [...anomalies]
        .sort((a, b) => new Date(a.time) - new Date(b.time))
        .map(a => ({
          time: a.time,
          displayTime: formatDateTime(a.time),
          value: a.value,
        }));
    }
    return [];
  }, [trendData, anomalies]);

  const contextAnomalies = selectedAnomaly
    ? getContextWindow(anomalies, selectedAnomaly.time)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <TabFilterBar showDateRange showProvince showMetric />

      {/* KPI cards */}
      <section>
        <SectionHeader
          title="Tổng quan bất thường"
          sub={`Metric: ${metricLabel} · Kỳ: ${startDate} → ${endDate}${selectedProvinceName ? ` · ${selectedProvinceName}` : ' · Toàn quốc'}`}
        />
        <div className="responsive-grid grid-cols-3">
          {[
            {
              label: 'Tổng bất thường',
              value: isLoading ? '...' : String(anomalyData?.total ?? anomalies.length),
              sub: `Ngưỡng |z| > 2.5σ`,
              color: C.violet,
            },
            {
              label: 'Tỉnh nhiều nhất',
              value: topProvince ? `${topProvince.name} · ${topProvince.count} lần` : '—',
              sub: topProvince ? 'Trong kỳ đã chọn' : 'Chưa có dữ liệu',
              color: C.danger,
            },
            {
              label: 'Z-score cao nhất',
              value: maxZScore ? `${Math.abs(maxZScore.z_score).toFixed(2)}σ` : '—',
              sub: maxZScore
                ? `${metricLabel} · ${formatDateTime(maxZScore.time)}`
                : 'Chưa có dữ liệu',
              color: C.warning,
            },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              style={{ ...glassCard, textAlign: 'center', position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 30px ${color}20`; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, margin: '0 auto 12px', animation: 'pulse 2s infinite' }} />
              <p style={{ color: C.muted, fontSize: 14, margin: '0 0 8px', ...headFont }}>{label}</p>
              <p style={{ color, fontSize: 18, fontWeight: 700, margin: '0 0 4px', ...monoFont }}>{value}</p>
              <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Line chart + ReferenceDot */}
      <section>
        <SectionHeader
          title={`Biểu đồ ${selectedProvinceId ? 'AQI' : metricLabel} và điểm bất thường`}
          sub="Điểm đỏ = bất thường (ReferenceDot) · Ngưỡng 2.5σ và 3.5σ"
        />
        <div style={{ ...glassCard }}>
          <ResponsiveContainer width="100%" height={280}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Đang phân tích bất thường...
              </div>
            ) : isError ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.danger }}>
                Có lỗi khi tải dữ liệu cảnh báo.
              </div>
            ) : chartData.length === 0 && anomalies.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Không có dữ liệu trong khoảng thời gian đã chọn.
                {selectedProvinceId == null && ' Hãy chọn tỉnh ở bộ lọc để xem biểu đồ chi tiết.'}
              </div>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="displayTime" tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                {chartData.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={C.sky}
                    strokeWidth={2}
                    dot={false}
                    name={selectedProvinceId ? 'AQI' : metricLabel}
                  />
                )}
                {anomalies.map((a, i) => {
                  const displayTime = formatChartTime(a.time);
                  const chartPoint = chartData.find(p => p.displayTime === displayTime || p.time === a.time);
                  if (!chartPoint) return null;
                  return (
                    <ReferenceDot
                      key={`anomaly-${i}`}
                      x={chartPoint.displayTime}
                      y={chartPoint.value ?? a.value}
                      r={6}
                      fill={severityColor(a.severity)}
                      stroke="none"
                    />
                  );
                })}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Bảng bất thường */}
      <section>
        <SectionHeader title="Danh sách bất thường" sub="Nhấp vào dòng để xem chi tiết ±3 giờ" />
        <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid rgba(248,113,113,0.15)' }}>
                {['Tỉnh', 'Thời điểm', 'Giá trị đo', 'Z-score', 'Mức độ'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontSize: 13, ...headFont }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: C.muted }}>Đang tải...</td>
                </tr>
              ) : anomalies.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: C.muted }}>
                    Không phát hiện bất thường nào với ngưỡng hiện tại.
                  </td>
                </tr>
              ) : (
                anomalies.map((a, i) => {
                  const isSelected = selectedAnomaly?.time === a.time && selectedAnomaly?.province_id === a.province_id;
                  const level = severityLabel(a.severity);
                  const color = severityColor(a.severity);
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isSelected ? 'rgba(248,113,113,0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => setSelectedAnomaly(isSelected ? null : a)}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(248,113,113,0.04)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '10px 16px', color: C.text, fontSize: 15, ...headFont }}>
                        {provinceNameMap[a.province_id] || `Tỉnh ${a.province_id}`}
                      </td>
                      <td style={{ padding: '10px 16px', color: C.muted, fontSize: 14, ...monoFont }}>
                        {formatDateTime(a.time)}
                      </td>
                      <td style={{ padding: '10px 16px', color: C.text, fontSize: 14, fontWeight: 700, ...monoFont }}>
                        {a.value != null ? a.value.toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ color, fontWeight: 700, ...monoFont }}>
                          {a.z_score?.toFixed(2)}σ
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          background: `${color}22`,
                          border: `1px solid ${color}`,
                          borderRadius: 12,
                          padding: '3px 10px',
                          fontSize: 13,
                          color,
                          ...headFont,
                        }}>
                          {a.severity === 'very_high' ? '🚨' : '⚠️'} {level}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Chi tiết ±3 giờ khi click */}
      {selectedAnomaly && (
        <section>
          <SectionHeader
            title="Chi tiết bất thường ±3 giờ"
            sub={`${provinceNameMap[selectedAnomaly.province_id] || ''} · ${formatDateTime(selectedAnomaly.time)} · Z=${selectedAnomaly.z_score?.toFixed(2)}σ`}
          />
          <div style={{ ...glassCard }}>
            {contextAnomalies.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 15, margin: 0 }}>
                Không có sự kiện bất thường nào khác trong cửa sổ ±3 giờ.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contextAnomalies.map((a, i) => {
                  const isCenter = a.time === selectedAnomaly.time && a.province_id === selectedAnomaly.province_id;
                  const color = severityColor(a.severity);
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr auto auto',
                        gap: 12,
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: isCenter ? `${color}15` : 'rgba(255,255,255,0.02)',
                        border: isCenter ? `1px solid ${color}44` : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <span style={{ color: C.muted, fontSize: 14, ...monoFont }}>{formatDateTime(a.time)}</span>
                      <span style={{ color: C.text, fontSize: 15, ...headFont }}>
                        {provinceNameMap[a.province_id]} · {METRIC_LABELS[a.metric] ?? a.metric}
                        {isCenter && <span style={{ color, marginLeft: 8 }}>← điểm đang xem</span>}
                      </span>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: 700, ...monoFont }}>
                        {a.value?.toFixed(2)}
                      </span>
                      <span style={{ color, fontSize: 14, fontWeight: 700, ...monoFont }}>
                        {a.z_score?.toFixed(2)}σ
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default AlertsTab;
