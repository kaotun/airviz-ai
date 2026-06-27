// Tab Tổng quan — KPI cards + line chart + top 5 tỉnh
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/dashboard'
import { useFilterStore } from '../store/filterStore'
import { getAqiInfo, classifyAqi } from '../utils/aqi'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

function KPICard({ title, value, unit, sub }: {
  title: string; value: string | number | null; unit?: string; sub?: string
}) {
  return (
    <div className="card card-hover" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4, color: 'var(--text-secondary)' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Overview() {
  const { startDate, endDate } = useFilterStore()

  const { data: overview, isLoading } = useQuery({
    queryKey: ['overview', startDate, endDate],
    queryFn:  () => dashboardApi.getOverview(startDate, endDate),
  })

  const { data: trend } = useQuery({
    queryKey: ['trend', startDate, endDate],
    queryFn:  () => dashboardApi.getTrend(startDate, endDate),
  })

  const { data: topPolluted } = useQuery({
    queryKey: ['top-polluted', startDate, endDate],
    queryFn:  () => dashboardApi.getTopPolluted(startDate, endDate),
  })

  const kpi = overview?.kpi

  return (
    <div className="page-enter" style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Tổng quan chất lượng không khí</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
        {startDate} → {endDate} · Toàn quốc
      </p>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KPICard title="AQI Trung bình toàn quốc" value={kpi?.aqi_national} />
        <KPICard title="PM2.5 Trung bình" value={kpi?.pm25_national} unit="µg/m³" />
        <KPICard title="Tỉnh vượt ngưỡng AQI > 100" value={kpi?.provinces_exceeded} sub="Nguy hiểm" />
        <KPICard title="Tổng số bản ghi" value={kpi?.total_readings?.toLocaleString()} sub="đã thu thập" />
      </div>

      {/* Trend chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📈 Xu hướng AQI toàn quốc</h2>
        {isLoading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend?.data ?? []}>
              <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }}
              />
              <Line
                type="monotone" dataKey="aqi" stroke="var(--brand-primary)"
                strokeWidth={2} dot={false} name="AQI"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 5 tỉnh */}
      <div className="card">
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>🏭 Top 5 tỉnh ô nhiễm nhất</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(topPolluted?.provinces ?? []).map((p: any, i: number) => {
            const info = getAqiInfo(p.aqi_level)
            return (
              <div key={p.province_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 20, color: 'var(--text-muted)', fontSize: 13 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{p.province_name}</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 99,
                  background: info.color + '22',
                  color: info.color,
                  fontSize: 13, fontWeight: 600
                }}>{p.aqi_avg}</span>
              </div>
            )
          })}
          {!topPolluted && <div className="skeleton" style={{ height: 120 }} />}
        </div>
      </div>
    </div>
  )
}
