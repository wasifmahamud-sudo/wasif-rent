import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const menuGroups = [
  {
    title: 'MAIN MENU',
    items: [
      { label: 'Dashboard', path: '/tenant', icon: '⌂', end: true },
      { label: 'My Bills', path: '/tenant/bills', icon: '▤' },
      { label: 'Electricity Usage', path: '/tenant/electricity', icon: '⚡' },
      { label: 'Payment History', path: '/tenant/payments', icon: '↔' },
      { label: 'Payment Receipts', path: '/tenant/receipts', icon: '▧' },
      { label: 'My Profile', path: '/tenant/profile', icon: '♙' },
    ],
  },
  {
    title: 'COMMUNICATION',
    items: [
      { label: 'Notice Board', path: '/tenant/notices', icon: '▣' },
      { label: 'Complaint Box', path: '/tenant/complaints', icon: '✉' },
    ],
  },
]

export default function TenantShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    document.body.classList.toggle('tenant-sidebar-open', sidebarOpen)

    return () => {
      document.body.classList.remove('tenant-sidebar-open')
    }
  }, [sidebarOpen])

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Logout failed:', error)
      setLoggingOut(false)
    }
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  return (
    <div className="tenant-layout">
      {sidebarOpen && (
        <button
          type="button"
          className="tenant-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      )}

      <aside className={`tenant-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="tenant-sidebar-header">
          <div className="tenant-brand-icon">W</div>

          <div className="tenant-brand-text">
            <strong>Wasif Rent</strong>
            <span>Tenant Portal</span>
          </div>

          <button
            type="button"
            className="tenant-sidebar-close"
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="tenant-sidebar-label">WORKSPACE</div>

        <nav className="tenant-sidebar-nav">
          {menuGroups.map((group) => (
            <div className="tenant-menu-group" key={group.title}>
              <div className="tenant-menu-heading">{group.title}</div>

              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={'end' in item ? item.end : false}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `tenant-menu-link ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="tenant-menu-icon">{item.icon}</span>
                  <span>{item.label}</span>

                  {item.label === 'Notice Board' && (
                    <span className="tenant-menu-arrow">›</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="tenant-sidebar-bottom">
          <button
            type="button"
            className="tenant-menu-link tenant-theme-button"
            onClick={toggle}
          >
            <span className="tenant-menu-icon">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <div className="tenant-sidebar-divider" />

          <button
            type="button"
            className="tenant-menu-link tenant-logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span className="tenant-menu-icon">↪</span>
            <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>

          <div className="tenant-sidebar-footer">
            Wasif Rent Management
          </div>
        </div>
      </aside>

      <main className="tenant-main">
        <header className="tenant-topbar">
          <button
            type="button"
            className="tenant-menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div className="tenant-topbar-title">
            <strong>Tenant Portal</strong>
            <span>Manage your rental account</span>
          </div>

          <button
            type="button"
            className="tenant-topbar-theme"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </header>

        <div className="tenant-page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```[cite: 1]
