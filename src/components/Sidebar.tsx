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
      return path === to || (loc.pathname === to.split('#')[0] && loc.hash === '#' + to.split('#')[1])
    }
    if (to === '/admin') return loc.pathname === '/admin'
    return loc.pathname === to
  }

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} />
      )}
      <aside
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
          background: 'var(--card, #fff)', borderRight: '1px solid var(--border, #e5e7eb)',
          zIndex: 100, transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease', overflowY: 'auto', padding: '16px 12px 24px',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 8px' }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>Home Rent</div>
          <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '4px 10px' }}>✕</button>
        </div>
        {SECTIONS.map((sec) => (
          <div key={sec.title} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', padding: '4px 10px', marginBottom: 4 }}>
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
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, marginBottom: 2, textDecoration: 'none',
                    fontWeight: active ? 700 : 500, fontSize: '0.88rem',
                    color: active ? 'var(--primary)' : 'var(--text, #1f2937)',
                    background: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </aside>
    </>
  )
}
