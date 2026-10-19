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
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`admin-sidebar${open ? ' is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="sidebar-head">
          <div className="sidebar-brand">Home Rent</div>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="sidebar-section">
              <div className="sidebar-section-title">{sec.title}</div>
              {sec.items.map((item) => {
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={`sidebar-link${active ? ' active' : ''}`}
                  >
                    <span className="sidebar-icon">{item.icon}</span>
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
