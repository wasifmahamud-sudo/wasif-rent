import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    document.body.classList.add('has-admin-menu')
    return () => document.body.classList.remove('has-admin-menu')
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [loc.pathname, loc.hash])

  useEffect(() => {
    if (open) {
      document.body.classList.add('sidebar-open')
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.classList.remove('sidebar-open')
        document.body.style.overflow = prev
      }
    }
    document.body.classList.remove('sidebar-open')
    document.body.style.overflow = ''
  }, [open])

  useEffect(() => {
    if (!loc.hash) return
    const id = loc.hash.replace('#', '')
    const tryScroll = () => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    tryScroll()
    const t = setTimeout(tryScroll, 300)
    return () => clearTimeout(t)
  }, [loc.pathname, loc.hash])

  return (
    <div className="admin-shell" style={{ minHeight: '100vh' }}>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <button
        type="button"
        className="menu-fab"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="admin-shell-main">{children}</div>
    </div>
  )
}
