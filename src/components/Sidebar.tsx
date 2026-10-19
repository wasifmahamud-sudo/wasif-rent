import { Link, useLocation } from 'react-router-dom'

type Item = { to: string; label: string; icon: string }

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'MAIN',
    items: [{ to: '/admin', label: 'Dashboard', icon: '📊' }],
  },
  {
    title: 'TENANT',
    items: [{ to: '/admin/tenants', label: 'Tenants', icon: '👥' }],
  },
  {
    title: 'FINANCE',
    items: [
      { to: '/admin/bills', label: 'Bills & Invoices', icon: '📋' },
      { to: '/admin/reports', label: 'Income & Expense', icon: '📈' },
      { to: '/admin/reports#other-income', label: 'Other Income', icon: '💵' },
      { to: '/admin/reports#house-expense', label: 'House Expenses', icon: '🏠' },
      { to: '/admin/reports#personal-expense', label: 'Personal Expenses', icon: '🛒' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [{ to: '/admin/reminders', label: 'Reminders', icon: '🔔' }],
  },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation()
  const path = loc.pathname + (loc.hash || '')

  const isActive = (to: string) => {
    if (to.includes('#')) {
      return (
        path === to ||
        (loc.pathname === to.split('#')[0] && loc.hash === '#' + to.split('#')[1])
      )
    }
    if (to === '/admin') return loc.pathname === '/admin'
    return loc.pathname === to || loc.pathname.startsWith(to + '/')
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 130,
            touchAction: 'none',
          }}
        />
      )}

      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(280px, 86vw)',
          background: 'var(--card, #ffffff)',
          borderRight: '1px solid var(--border, #e5e7eb)',
          zIndex: 140,
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 0.22s ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: open ? '4px 0 28px rgba(0,0,0,0.18)' : 'none',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          overflow: 'hidden',
        }}
        aria-hidden={!open}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 12px 10px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--primary, #0f3c6e)', fontSize: '1rem' }}>
            Home Rent
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--bg, #eef2f7)',
              color: 'var(--text, #1a1a2e)',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '10px 10px 24px',
          }}
        >
          {SECTIONS.map((sec) => (
            <div key={sec.title} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--muted, #6b7280)',
                  padding: '6px 10px 4px',
                }}
              >
                {sec.title}
              </div>
              {sec.items.map((item) => {
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 12px',
                      borderRadius: 10,
                      marginBottom: 2,
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      color: active ? 'var(--primary, #0f3c6e)' : 'var(--text, #1a1a2e)',
                      background: active ? 'rgba(15, 60, 110, 0.1)' : 'transparent',
                      textDecoration: 'none',
                      minHeight: 44,
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', width: '1.4rem', textAlign: 'center' }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
