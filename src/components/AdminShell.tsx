import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  useEffect(() => { setOpen(false) }, [loc.pathname, loc.hash])

  useEffect(() => {
    if (!loc.hash) return
    const id = loc.hash.replace('#', '')
    const t = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
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
          position: 'fixed', top: 12, left: 12, zIndex: 80,
          width: 44, height: 44, borderRadius: 12,
          border: '1.5px solid var(--border)', background: 'var(--card, #fff)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)', fontSize: '1.25rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ☰
      </button>
      <div style={{ paddingTop: 4 }}>{children}</div>
    </div>
  )
}
