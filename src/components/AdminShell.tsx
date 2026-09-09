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

  useEffect(() => { setOpen(false) }, [loc.pathname, loc.hash])

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
    <div style={{ minHeight: '100vh' }}>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          zIndex: 200,
          height: 40,
          padding: '0 12px',
          borderRadius: 10,
          border: 'none',
          background: '#0f3c6e',
          color: '#fff',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: '1.15rem' }}>☰</span>
        Menu
      </button>
      <div>{children}</div>
    </div>
  )
}
