import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboard';
import { useFilterStore } from '../../store/filterStore';

import {
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

import {
  C, glassCard, monoFont, headFont, DarkTooltip, SectionHeader,
} from '../../utils/dashboardConstants';

const COLOR_PALETTE = [C.sky, C.violet, C.emerald];

const RADAR_METRICS = [
  { key: 'pm2_5', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
  { key: 'carbon_monoxide', label: 'CO' },
  { key: 'nitrogen_dioxide', label: 'NO₂' },
  { key: 'sulphur_dioxide', label: 'SO₂' },
  { key: 'ozone', label: 'O₃' },
  { key: 'dust', label: 'Dust' },
];

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? `${d.getDate()}/${d.getMonth() + 1}` : dateStr;
}

function computeStd(values) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function mergeTimeseries(timeseries, provinceIds) {
  if (!timeseries || provinceIds.length === 0) return [];

  const dateMap = {};
  for (const pid of provinceIds) {
    const series = timeseries[pid] ?? timeseries[String(pid)] ?? [];
    for (const point of series) {
      if (!dateMap[point.date]) {
        dateMap[point.date] = { date: point.date, displayTime: formatDateLabel(point.date) };
      }
      dateMap[point.date][`province_${pid}`] = point.value;
    }
  }

  return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function unwrapProvinces(mapData) {
  if (Array.isArray(mapData)) return mapData;
  return mapData?.provinces ?? [];
}

const CompareTab = () => {
  const { selectedProvinceId, startDate, endDate } = useFilterStore();
  const [compareProvinces, setCompareProvinces] = useState([]);
  const [visibleState, setVisibleState] = useState({});

  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData(),
  });

  const provinceList = useMemo(() => unwrapProvinces(mapData), [mapData]);

  // Đồng bộ tỉnh từ global filter nếu user đã chọn
  useEffect(() => {
    if (selectedProvinceId && !compareProvinces.includes(selectedProvinceId)) {
      setCompareProvinces(prev => [selectedProvinceId, ...prev].slice(0, 3));
    }
  }, [selectedProvinceId]);

  const activeProvinces = compareProvinces.slice(0, 3);
  const compareIdsStr = activeProvinces.join(',');

  const { data: compData, isLoading, isError } = useQuery({
    queryKey: ['comparison', startDate, endDate, compareIdsStr],
    queryFn: () => dashboardApi.getComparison(activeProvinces, startDate, endDate),
    enabled: activeProvinces.length > 0,
  });

  const detailQueries = useQueries({
    queries: activeProvinces.map(id => ({
      queryKey: ['provinceDetail', id],
      queryFn: () => dashboardApi.getProvinceDetail(id),
      enabled: activeProvinces.length > 0,
    })),
  });

  const provinceNameMap = useMemo(() => {
    const map = {};
    provinceList.forEach(p => { map[p.province_id] = p.province_name; });
    detailQueries.forEach((q, i) => {
      if (q.data?.province_name) map[activeProvinces[i]] = q.data.province_name;
    });
    return map;
  }, [provinceList, detailQueries, activeProvinces]);

  const renderingProvinces = activeProvinces.map((id, index) => ({
    id: String(id),
    label: provinceNameMap[id] || `Tỉnh ${id}`,
    color: COLOR_PALETTE[index] || C.muted,
  }));

  const timeSeriesData = useMemo(
    () => mergeTimeseries(compData?.timeseries, activeProvinces),
    [compData?.timeseries, activeProvinces],
  );

  const statistics = useMemo(() => {
    const timeseries = compData?.timeseries ?? {};
    return (compData?.stats ?? []).map(stat => {
      const pid = stat.province_id;
      const series = timeseries[pid] ?? timeseries[String(pid)] ?? [];
      const aqiValues = series.map(p => p.value).filter(v => v != null);
      return {
        province_id: pid,
        min: stat.aqi_min,
        max: stat.aqi_max,
        mean: stat.aqi_mean,
        std: computeStd(aqiValues),
      };
    });
  }, [compData]);

  const radarChartData = useMemo(() => {
    return RADAR_METRICS.map(({ key, label }) => {
      const row = { metric: label };
      detailQueries.forEach((q, i) => {
        const pid = activeProvinces[i];
        row[`province_${pid}`] = q.data?.[key] ?? 0;
      });
      return row;
    });
  }, [detailQueries, activeProvinces]);

  const toggleProvince = (id) => {
    setCompareProvinces(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const toggleVisibility = (id) => {
    setVisibleState(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Multi-select tối đa 3 tỉnh */}
      <section>
        <SectionHeader
          title="Chọn tỉnh so sánh"
          sub={`Tối đa 3 tỉnh · Kỳ: ${startDate} → ${endDate}`}
        />
        <div style={{ ...glassCard, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {provinceList.length === 0 ? (
            <span style={{ color: C.muted, fontSize: 13 }}>Đang tải danh sách tỉnh...</span>
          ) : (
            provinceList.map(p => {
              const selected = compareProvinces.includes(p.province_id);
              const disabled = !selected && compareProvinces.length >= 3;
              return (
                <button
                  key={p.province_id}
                  onClick={() => !disabled && toggleProvince(p.province_id)}
                  style={{
                    background: selected ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected ? C.sky : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 16,
                    padding: '5px 14px',
                    color: disabled ? 'rgba(255,255,255,0.2)' : selected ? C.sky : C.text,
                    fontSize: 12,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    ...headFont,
                  }}
                >
                  {p.province_name}
                </button>
              );
            })
          )}
        </div>
        {compareProvinces.length >= 3 && (
          <p style={{ color: C.warning, fontSize: 12, marginTop: 8 }}>
            ⚠️ Đã đạt giới hạn 3 tỉnh. Bỏ chọn một tỉnh để thêm tỉnh khác.
          </p>
        )}
      </section>

      {activeProvinces.length === 0 ? (
        <div style={{ ...glassCard, padding: 40, textAlign: 'center', color: C.muted }}>
          Vui lòng chọn ít nhất 1 tỉnh để tiến hành so sánh dữ liệu.
        </div>
      ) : (
        <>
          {/* Toggle ẩn/hiện đường biểu đồ */}
          <section>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {renderingProvinces.map(({ id, label, color }) => {
                const isVisible = visibleState[id] !== false;
                return (
                  <button
                    key={id}
                    onClick={() => toggleVisibility(id)}
                    style={{
                      background: isVisible ? `${color}22` : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isVisible ? color : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 24,
                      padding: '8px 20px',
                      color: isVisible ? color : 'rgba(255,255,255,0.4)',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      ...headFont,
                    }}
                  >
                    ● {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Multi-line chart AQI */}
          <section>
            <SectionHeader
              title="Biểu đồ xu hướng AQI"
              sub="So sánh AQI theo thời gian · Nhấp tên tỉnh để ẩn/hiện"
            />
            <div style={{ ...glassCard }}>
              <ResponsiveContainer width="100%" height={320}>
                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                    Đang tải dữ liệu so sánh...
                  </div>
                ) : isError ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.danger }}>
                    Có lỗi khi tải dữ liệu. Vui lòng thử lại.
                  </div>
                ) : timeSeriesData.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                    Không có dữ liệu trong khoảng thời gian đã chọn.
                  </div>
                ) : (
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="displayTime" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 30']} />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    {renderingProvinces.map(({ id, label, color }) => {
                      if (visibleState[id] === false) return null;
                      return (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={`province_${id}`}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          name={label}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>

          {/* Radar + Bảng thống kê */}
          <section>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div style={{ ...glassCard }}>
                <SectionHeader
                  title="Radar cơ cấu thành phần"
                  sub="Giá trị đo mới nhất của 7 biến môi trường"
                />
                <ResponsiveContainer width="100%" height={280}>
                  {detailQueries.some(q => q.isLoading) ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                      Đang tải...
                    </div>
                  ) : (
                    <RadarChart data={radarChartData}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: C.muted, fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: C.muted, fontSize: 9 }} />
                      {renderingProvinces.map(({ id, label, color }) => {
                        if (visibleState[id] === false) return null;
                        return (
                          <Radar
                            key={id}
                            name={label}
                            dataKey={`province_${id}`}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.12}
                            strokeWidth={2}
                          />
                        );
                      })}
                      <Tooltip content={<DarkTooltip />} />
                      <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  )}
                </ResponsiveContainer>
              </div>

              <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 8px 20px' }}>
                  <SectionHeader title="Chỉ số thống kê mô tả (AQI)" />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '14px 20px', textAlign: 'left', color: C.muted, fontSize: 12, ...headFont }}>
                        Chỉ số
                      </th>
                      {renderingProvinces.map(({ id, label, color }) => (
                        <th key={id} style={{ padding: '14px 20px', textAlign: 'center', color, fontSize: 13, ...headFont }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'min', label: 'Thấp nhất (Min)' },
                      { key: 'max', label: 'Cao nhất (Max)' },
                      { key: 'mean', label: 'Trung bình (Mean)' },
                      { key: 'std', label: 'Độ lệch chuẩn (Std)' },
                    ].map((metricRow, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 20px', color: C.muted, fontSize: 13, ...headFont }}>
                          {metricRow.label}
                        </td>
                        {renderingProvinces.map(({ id }) => {
                          const provStat = statistics.find(s => String(s.province_id) === id);
                          const rawValue = provStat ? provStat[metricRow.key] : null;
                          const displayValue = typeof rawValue === 'number' ? rawValue.toFixed(1) : 'N/A';
                          return (
                            <td key={id} style={{ padding: '12px 20px', textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 600, ...monoFont }}>
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default CompareTab;
