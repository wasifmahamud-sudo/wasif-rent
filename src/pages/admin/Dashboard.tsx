import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'

interface Stats {
  tenants: number
  rooms: number
  totalRent: number
  totalEC: number
  totalCollected: number
  totalDue: number
  unpaidCount: number
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    tenants: 0, rooms: 0, totalRent: 0, totalEC: 0,
    totalCollected: 0, totalDue: 0, unpaidCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  useEffect(() => {
    loadStats()
  }, [month])

  async function loadStats() {
    setLoading(true)
    try {
      const [tenantsRes, roomsRes, billsRes] = await Promise.all([
        supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
        supabase.from('bills').select('rent_amount, electricity_amount, amount_paid, remaining_due, status').eq('billing_month', month),
      ])

      const bills = billsRes.data || []
      let totalRent = 0, totalEC = 0, totalCollected = 0, totalDue = 0, unpaidCount = 0
      bills.forEach((b) => {
        totalRent += Number(b.rent_amount) || 0
        totalEC += Number(b.electricity_amount) || 0
        totalCollected += Number(b.amount_paid) || 0
        totalDue += Number(b.remaining_due) || 0
        if (b.status === 'unpaid' || b.status === 'partial') unpaidCount++
      })

      setStats({
        tenants: tenantsRes.count || 0,
        rooms: roomsRes.count || 0,
        totalRent,
        totalEC,
        totalCollected,
        totalDue,
        unpaidCount,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const monthLabel = (() => {
    const d = new Date(month)
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[d.getMonth()]} ${d.getFullYear()}`
  })()

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Admin Dashboard</h1>
            <div className="sub">Welcome, {profile?.full_name || 'Admin'}</div>
          </div>
          <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 12px' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="page-content">
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 700, color: 'var(--muted)', fontSize: '0.8rem' }}>Month:</label>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value + '-01')}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white' }}
          />
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{monthLabel}</span>
        </div>

        {loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} />লোড হচ্ছে...</div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: 16 }}>
              <div className="sum-card blue">
                <div className="label">Active Tenants</div>
                <div className="value">{stats.tenants}</div>
              </div>
              <div className="sum-card orange">
                <div className="label">Rooms</div>
                <div className="value">{stats.rooms}</div>
              </div>
              <div className="sum-card green">
                <div className="label">Collected</div>
                <div className="value">৳{fmtBDT(stats.totalCollected)}</div>
              </div>
              <div className="sum-card due">
                <div className="label">Outstanding</div>
                <div className="value">৳{fmtBDT(stats.totalDue)}</div>
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="sum-card">
                <div className="label">This Month Rent</div>
                <div className="value">৳{fmtBDT(stats.totalRent)}</div>
              </div>
              <div className="sum-card">
                <div className="label">Electricity Bill</div>
                <div className="value">৳{fmtBDT(stats.totalEC)}</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary)' }}>
                Unpaid / Partial: {stats.unpaidCount} bill(s)
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          <Link to="/admin/bills" className="btn btn-primary" style={{ padding: 14 }}>📋 Monthly Bills</Link>
          <Link to="/admin/tenants" className="btn btn-primary" style={{ padding: 14 }}>👥 Tenants</Link>
          <Link to="/admin/payments" className="btn btn-primary" style={{ padding: 14 }}>💰 Payments</Link>
          <Link to="/admin/rooms" className="btn btn-primary" style={{ padding: 14 }}>🏠 Rooms</Link>
          <Link to="/admin/settings" className="btn btn-ghost" style={{ padding: 14 }}>⚙️ Settings</Link>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="bottom-nav">
        <button className="nav-item active"><span className="icon">📊</span>Dashboard</button>
        <Link to="/admin/bills" className="nav-item"><span className="icon">📋</span>Bills</Link>
        <Link to="/admin/tenants" className="nav-item"><span className="icon">👥</span>Tenants</Link>
        <Link to="/admin/payments" className="nav-item"><span className="icon">💰</span>Payments</Link>
      </div>
    </div>
  )
}
