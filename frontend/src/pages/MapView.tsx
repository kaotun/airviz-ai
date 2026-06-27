// Placeholder pages — sẽ implement chi tiết trong các bước tiếp theo
export default function MapView() {
  return (
    <div className="page-enter">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🗺️ Bản đồ AQI</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Choropleth map 63 tỉnh thành</p>
      <div className="card" style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>🚧 Leaflet map — coming in next step</span>
      </div>
    </div>
  )
}
