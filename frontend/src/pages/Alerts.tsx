export default function Alerts() {
  return (
    <div className="page-enter">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🚨 Cảnh báo bất thường</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Z-score anomaly detection · Rolling 7 ngày</p>
      <div className="card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>🚧 Anomaly timeline — coming soon</span>
      </div>
    </div>
  )
}
