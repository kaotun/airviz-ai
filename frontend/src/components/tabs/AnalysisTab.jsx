import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import HeatMap from 'react-heatmap-grid';
import {
  ComposedChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import { dashboardApi, analyticsApi } from '../../api/dashboard';
import { useFilterStore } from '../../store/filterStore';
import { METRIC_LABELS } from '../../utils/aqi';
import {
  C, AQI_COLORS, AQI_LABELS, glassCard, monoFont, headFont,
  DarkTooltip, SectionHeader,
} from '../../utils/dashboardConstants';

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

const selectStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '6px 12px',
  color: C.text,
  fontSize: 12,
  outline: 'none',
  cursor: 'pointer',
  ...monoFont,
};

const AnalysisTab = () => {
  const {
    startDate, endDate,
    selectedProvinceId, selectedProvinceName,
    selectedMetric, setProvince, setMetric,
  } = useFilterStore();

  const provinceLabel = selectedProvinceName ?? 'Toàn quốc';

  // ── Dropdown tỉnh: lấy danh sách 63 tỉnh từ map data ─────────────────────
  const { data: mapRes } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData(),
  });
  const provinceOptions = mapRes?.provinces ?? [];

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

  // ── Phân phối AQI theo tháng (đếm số ngày theo 6 mức) ────────────────────
  const { data: trendRes, isLoading: trendLoading } = useQuery({
    queryKey: ['aqiTrendMonthly', selectedProvinceId, startDate, endDate],
    queryFn: () => dashboardApi.getTrend(startDate, endDate, selectedProvinceId ?? undefined),
  });

  const monthDist = useMemo(() => {
    const rows = trendRes?.data ?? [];
    const byMonth = new Map();
    rows.forEach((r) => {
      const aqi = r.aqi == null ? null : Number(r.aqi);
      if (aqi == null) return;
      const [y, m] = String(r.date).split('-');
      const key = `${m}/${y.slice(2)}`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Bộ chọn tỉnh + metric — đồng bộ Global Filter Store */}
      <section>
        <SectionHeader
          title="Phân tích chuyên sâu"
          sub={`Khoảng dữ liệu: ${startDate} → ${endDate} · ${provinceLabel}`}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedProvinceId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                setProvince(null, null);
              } else {
                const p = provinceOptions.find((o) => String(o.province_id) === v);
                setProvince(Number(v), p?.province_name ?? null);
              }
            }}
            style={selectStyle}
          >
            <option value="" style={{ background: C.card }}>Toàn quốc</option>
            {provinceOptions.map((p) => (
              <option key={p.province_id} value={p.province_id} style={{ background: C.card }}>
                {p.province_name}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                style={{
                  background: selectedMetric === m.key
                    ? `linear-gradient(135deg,${C.sky},${C.violet})`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedMetric === m.key ? C.sky : C.border}`,
                  borderRadius: 20,
                  padding: '6px 16px',
                  color: selectedMetric === m.key ? '#fff' : C.muted,
                  fontSize: 12,
                  cursor: 'pointer',
                  ...headFont,
                }}
              >
                {m.short}
              </button>
            ))}
          </div>
        </div>
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
                <span key={label} style={{ fontSize: 12, color: C.muted, ...headFont }}>
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
                  tick={{ fill: C.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={tickInterval}
                  tickFormatter={(v) => String(v).split(' ')[0]}
                />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
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
            <div style={{ minWidth: 620 }}>
              <HeatMap
                xLabels={corrShort}
                yLabels={corrShort}
                data={corrMatrix}
                squares
                height={52}
                xLabelsLocation="bottom"
                yLabelWidth={70}
                cellStyle={(bg, value) => ({
                  background: corrBg(value),
                  fontSize: 11,
                  fontWeight: 600,
                  color: value != null && Math.abs(value) > 0.4 ? '#fff' : C.muted,
                  fontFamily: "'JetBrains Mono',monospace",
                  borderRadius: 4,
                })}
                cellRender={(value) => (value == null ? '–' : Number(value).toFixed(2))}
                title={(value, unit, x, y) => {
                  const pair = `${corrDisplay[y] ?? corrShort[y]} ↔ ${corrDisplay[x] ?? corrShort[x]}`;
                  if (value == null) return `${pair}: không đủ dữ liệu`;
                  return `${pair}: tương quan ${corrStrengthVi(value)} (r = ${Number(value).toFixed(2)})`;
                }}
              />
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
                <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                {AQI_LABELS.map((label, i) => (
                  <Bar
                    key={label}
                    dataKey={label}
                    stackId="aqi"
                    fill={AQI_COLORS[i]}
                    radius={i === AQI_LABELS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {AQI_LABELS.map((label, i) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted }}>
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
