import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  ComposedChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

import { dashboardApi, analyticsApi } from '../../api/dashboard';
import { useFilterStore } from '../../store/filterStore';
import { exportToCSV } from '../../utils/exportUtils';
import { METRIC_LABELS } from '../../utils/aqi';
import {
  C, AQI_COLORS, AQI_LABELS, aqiColor, glassCard, monoFont, headFont, provinces,
  chartDefaults, DarkTooltip, SectionHeader
} from '../../utils/dashboardConstants';
import TabFilterBar from '../TabFilterBar';

const METRICS = [
  { key: 'pm2_5',            short: 'PM2.5' },
  { key: 'pm10',             short: 'PM10' },
  { key: 'carbon_monoxide',  short: 'CO' },
  { key: 'nitrogen_dioxide', short: 'NO₂' },
  { key: 'sulphur_dioxide',  short: 'SO₂' },
  { key: 'ozone',            short: 'O₃' },
  { key: 'dust',             short: 'Dust' },
];
const SHORT_LABEL = Object.fromEntries(METRICS.map((m) => [m.key, m.short]));

const aqiBucket = (aqi) =>
  aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : aqi <= 200 ? 3 : aqi <= 300 ? 4 : 5;

const corrBg = (v) => {
  if (v == null) return 'rgba(255,255,255,0.03)';
  const a = Math.min(Math.abs(v), 1);
  if (v > 0) return `rgba(56,189,248,${0.15 + a * 0.85})`;
  if (v < 0) return `rgba(248,113,113,${0.15 + a * 0.85})`;
  return 'rgba(255,255,255,0.06)';
};

const corrStrengthVi = (r) => {
  const a = Math.abs(r);
  const dir = r > 0 ? 'dương' : 'âm';
  if (a >= 0.9) return `${dir} rất mạnh`;
  if (a >= 0.7) return `${dir} mạnh`;
  if (a >= 0.5) return `${dir} trung bình`;
  if (a >= 0.3) return `${dir} yếu`;
  return 'rất yếu';
};



const AnalysisTab = () => {
  const {
    startDate, endDate,
    selectedProvinces,
    selectedMetric,
  } = useFilterStore();

  const selectedProvinceId = selectedProvinces[0]?.id;
  const selectedProvinceName = selectedProvinces[0]?.name;

  const provinceLabel = selectedProvinceName ?? 'Toàn quốc';



  // ── Chuỗi giá trị theo giờ của metric đang chọn ──────────────────────────
  const { data: tsRes, isLoading: tsLoading } = useQuery({
    queryKey: ['timeseries', selectedMetric, selectedProvinceId, startDate, endDate],
    queryFn: () => dashboardApi.getTimeseries({
      metric: selectedMetric,
      province_id: selectedProvinceId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const tsData = useMemo(() => (tsRes?.data ?? []).map((d) => {
    const t = new Date(d.time);
    const dd = String(t.getDate()).padStart(2, '0');
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const hh = String(t.getHours()).padStart(2, '0');
    return {
      label: `${dd}/${mm} ${hh}h`,
      value: d.value == null ? null : Number(d.value),
    };
  }), [tsRes]);

  const tsStats = useMemo(() => {
    const vals = tsData.map((d) => d.value).filter((v) => v != null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      mean: sum / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  }, [tsData]);

  const tickInterval = Math.max(0, Math.ceil(tsData.length / 12) - 1);

  // ── Dữ liệu xu hướng (Trend) để vẽ Heatmap và Bar Chart ────────────────────
  const { data: trendRes, isLoading: trendLoading } = useQuery({
    queryKey: ['trend', selectedProvinceId, startDate, endDate],
    queryFn: () => dashboardApi.getTrend(startDate, endDate, selectedProvinceId),
  });

  // ── Ma trận tương quan Pearson 7×7 ───────────────────────────────────────
  const { data: corrRes, isLoading: corrLoading } = useQuery({
    queryKey: ['correlation', selectedProvinceId, startDate, endDate],
    queryFn: () => analyticsApi.getCorrelation({
      province_id: selectedProvinceId,
      start_date: startDate,
      end_date: endDate,
    }),
  });

  const corrMatrix = corrRes?.matrix ?? [];
  const corrShort = (corrRes?.labels ?? []).map((l) => SHORT_LABEL[l] ?? l);
  const corrDisplay = corrRes?.display ?? [];

  const monthDist = useMemo(() => {
    const rows = trendRes?.data ?? [];
    const byMonth = new Map();
    rows.forEach((r) => {
      const aqi = r.aqi == null ? null : Number(r.aqi);
      if (aqi == null) return;
      // Fixed: The API returns `day`, not `date`
      const [y, m] = String(r.day || r.date || '').split('-');
      const key = y && m ? `${m}/${y.slice(2)}` : 'N/A';
      if (!byMonth.has(key)) byMonth.set(key, [0, 0, 0, 0, 0, 0]);
      byMonth.get(key)[aqiBucket(aqi)] += 1;
    });
    return [...byMonth.entries()].map(([month, counts]) => {
      const row = { month };
      AQI_LABELS.forEach((label, i) => { row[label] = counts[i]; });
      return row;
    });
  }, [trendRes]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      <TabFilterBar showDateRange showProvince showMetric />
      {/* ── Correlation & Insight ─────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Phân tích chuyên sâu"
          sub={`Khoảng dữ liệu: ${startDate} → ${endDate} · ${provinceLabel}`}
        >
          <button
            onClick={() => exportToCSV(trendRes?.data || [], `Data_${provinceLabel}_${startDate}_${endDate}`)}
            style={{
              background: 'rgba(56,189,248,0.1)',
              border: `1px solid ${C.sky}`,
              color: C.sky,
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            📥 Xuất CSV
          </button>
        </SectionHeader>
      </section>

      {/* Chuỗi giá trị theo giờ */}
      <section>
        <SectionHeader
          title={`Chuỗi giá trị ${SHORT_LABEL[selectedMetric] ?? selectedMetric} — ${provinceLabel}`}
          sub={METRIC_LABELS[selectedMetric] ?? ''}
        />
        <div style={{ ...glassCard }}>
          {tsStats && (
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Trung bình', value: tsStats.mean, color: C.sky },
                { label: 'Nhỏ nhất', value: tsStats.min, color: C.success },
                { label: 'Lớn nhất', value: tsStats.max, color: C.danger },
              ].map(({ label, value, color }) => (
                <span key={label} style={{ fontSize: 14, color: C.muted, ...headFont }}>
                  {label}: <strong style={{ color, ...monoFont }}>{value.toFixed(1)}</strong>
                </span>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            {tsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Đang tải...
              </div>
            ) : tsData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Không có dữ liệu trong khoảng ngày đã chọn
              </div>
            ) : (
              <ComposedChart data={tsData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.sky} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.sky} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.muted, fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                  tickFormatter={(v) => String(v).split(' ')[0]}
                />
                <YAxis tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={C.sky}
                  strokeWidth={2}
                  fill="url(#tsGrad)"
                  dot={false}
                  name={SHORT_LABEL[selectedMetric] ?? selectedMetric}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Ma trận tương quan Pearson */}
      <section>
        <SectionHeader
          title="Ma trận tương quan Pearson — 7 biến môi trường"
          sub={corrRes?.sample_size ? `n = ${corrRes.sample_size.toLocaleString('vi-VN')} bản ghi · hover vào ô để xem chi tiết` : 'hover vào ô để xem chi tiết'}
        />
        <div style={{ ...glassCard, overflowX: 'auto' }}>
          {corrLoading ? (
            <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>Đang tải...</div>
          ) : corrMatrix.length === 0 ? (
            <div style={{ color: C.muted, textAlign: 'center', padding: '40px 0' }}>
              Chưa có dữ liệu tương quan trong khoảng ngày đã chọn
            </div>
          ) : (
            <div style={{ minWidth: 620, display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {corrMatrix.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <div style={{ width: 70, fontSize: 14, color: C.muted, textAlign: 'right', paddingRight: 8 }}>{corrShort[i]}</div>
                    {row.map((val, j) => (
                      <div key={j} style={{
                        width: 52, height: 52,
                        background: corrBg(val),
                        fontSize: 13, fontWeight: 600,
                        color: val != null && Math.abs(val) > 0.4 ? '#fff' : C.muted,
                        fontFamily: "'JetBrains Mono',monospace",
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }} title={`${corrShort[i]} vs ${corrShort[j]}: ${val == null ? '–' : Number(val).toFixed(2)}`}>
                        {val == null ? '–' : Number(val).toFixed(2)}
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: 78 }}>
                  {corrShort.map((lbl, j) => (
                    <div key={j} style={{ width: 52, fontSize: 14, color: C.muted, textAlign: 'center' }}>
                      {lbl}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Phân phối AQI theo tháng */}
      <section>
        <SectionHeader
          title={`Phân phối AQI theo tháng — ${provinceLabel}`}
          sub="Số ngày ở từng mức AQI trong mỗi tháng"
        />
        <div style={{ ...glassCard }}>
          <ResponsiveContainer width="100%" height={280}>
            {trendLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Đang tải...
              </div>
            ) : monthDist.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted }}>
                Không có dữ liệu trong khoảng ngày đã chọn
              </div>
            ) : (
              <BarChart data={monthDist} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                {AQI_LABELS.map((label, i) => (
                  <Bar
                    key={label}
                    dataKey={label}
                    stackId="aqi"
                    fill={AQI_COLORS[i]}
                    maxBarSize={80}
                    radius={i === AQI_LABELS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {AQI_LABELS.map((label, i) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: C.muted }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: AQI_COLORS[i], display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AnalysisTab;
