import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Overview    from './pages/Overview'
import MapView     from './pages/MapView'
import Analysis    from './pages/Analysis'
import Comparison  from './pages/Comparison'
import Alerts      from './pages/Alerts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   5 * 60 * 1000,   // 5 phút
      retry:       2,
      refetchOnWindowFocus: false,
    }
  }
})

const NAV_ITEMS = [
  { to: '/',           icon: '📊', label: 'Tổng quan'  },
  { to: '/map',        icon: '🗺️',  label: 'Bản đồ'    },
  { to: '/analysis',  icon: '📈', label: 'Phân tích'  },
  { to: '/comparison',icon: '⚖️',  label: 'So sánh'   },
  { to: '/alerts',    icon: '🚨', label: 'Cảnh báo'   },
]

function Sidebar() {
  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--surface-card)',
      borderRight: '1px solid var(--surface-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 1.25rem 1.5rem', borderBottom: '1px solid var(--surface-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🌫️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>AirViz</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Air Quality AI</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '1rem 0.75rem', flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0.6rem 0.75rem',
              borderRadius: 8,
              marginBottom: 4,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
              transition: 'all 0.15s',
            })}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '1rem 1.25rem', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--surface-border)' }}>
        <div>Data: Open-Meteo API</div>
        <div>63 tỉnh · 2024–2026</div>
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
            <Routes>
              <Route path="/"           element={<Overview />} />
              <Route path="/map"        element={<MapView />} />
              <Route path="/analysis"   element={<Analysis />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/alerts"     element={<Alerts />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
