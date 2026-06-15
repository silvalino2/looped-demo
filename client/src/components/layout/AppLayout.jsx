import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from '../ui/Logo'

const navItems = [
  {
    label: 'New Video', path: '/',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    )
  },
  {
    label: 'History', path: '/history',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    )
  }
]

export default function AppLayout({ children }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220,
        minHeight: '100vh', background: '#0d0d0d',
        borderRight: '1px solid #1a1a1a',
        display: 'flex', flexDirection: 'column',
        transition: 'width 300ms cubic-bezier(0.16,1,0.3,1)',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        overflow: 'hidden'
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 0' : '24px 20px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 68
        }}>
          {!collapsed && <Link to="/"><Logo size="sm" /></Link>}
          {collapsed && <Logo size="sm" showText={false} />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', padding: 6, borderRadius: 6,
              transition: 'color 200ms', display: 'flex', alignItems: 'center', flexShrink: 0
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const active = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path} style={{
                display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px' : '10px 12px',
                borderRadius: 8, transition: 'all 200ms',
                background: active ? 'rgba(134,239,172,0.08)' : 'transparent',
                color: active ? '#86efac' : 'rgba(255,255,255,0.5)',
                fontSize: 13, fontWeight: active ? 500 : 400,
                justifyContent: collapsed ? 'center' : 'flex-start',
                letterSpacing: '-0.01em', textDecoration: 'none',
                borderLeft: active ? '2px solid #86efac' : '2px solid transparent',
                marginLeft: active && !collapsed ? -2 : 0
              }}
              onMouseEnter={e => !active && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)', e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent', e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Footer tag */}
        {!collapsed && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #1a1a1a' }}>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              No limits · No login
            </p>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: collapsed ? 64 : 220,
        transition: 'margin-left 300ms cubic-bezier(0.16,1,0.3,1)',
        minHeight: '100vh'
      }}>
        {children}
      </main>
    </div>
  )
}
