import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'

interface Stats {
  tenants: number
  rooms: number
  totalRent: number
  totalEC: number
  totalCollected: number
  monthDue: number
  allOutstanding: number
  unpaidCount: number
  tenantsWithDue: number
}

interface BillLite {
  tenant_id: string
  billing_month: string
  remaining_due: number
  previous_due: number
  rent_amount: number
  electricity_amount: number
  other_charge: number
  discount: number
  total_bill: number
  amount_paid: number
  status?: string
}

interface TenantDueRow {
  tenant_id: string
  full_name: string
  latest_month: string | null
  previous_due: number
  rent_amount: number
  electricity_amount: number
  amount_paid: number
  total_bill: number
  remaining_due: number
  has_month_bill: boolean
  carry_note: string
}

function tenantTrueOutstanding(bills: BillLite[]): {
  amount: number
  note: string
  latest: BillLite | null
} {
  if (!bills.length) return { amount: 0, note: 'No bills', latest: null }

  const sorted = [...bills].sort((a, b) =>
    a.billing_month < b.billing_month ? -1 : a.billing_month > b.billing_month ? 1 : 0
  )

  let total = 0
  let gaps = 0
  for (let i = 0; i < sorted.length; i++) {
    const rd = Math.max(0, Number(sorted[i].remaining_due) || 0)
    if (i < sorted.length - 1) {
      const nextPd = Math.max(0, Number(sorted[i + 1].previous_due) || 0)
      const carried = Math.min(rd, nextPd)
      const orphan = Math.round((rd - carried) * 100) / 100
      if (orphan > 0.009) {
        total += orphan
        gaps++
      }
    } else {
      total += rd
    }
  }

  total = Math.round(total * 100) / 100
  const latest = sorted[sorted.length - 1]
  let note = 'Latest bill balance'
  if (gaps > 0) note = `Includes ${gaps} uncarried old balance(s)`
  else if (sorted.length > 1) note = 'Carry-forward OK · latest only'

  return { amount: total, note, latest }
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    tenants: 0,
    rooms: 0,
    totalRent: 0,
    totalEC: 0,
    totalCollected: 0,
    monthDue: 0,
    allOutstanding: 0,
    unpaidCount: 0,
    tenantsWithDue: 0,
  })
  const [dueRows, setDueRows] = useState<TenantDueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  async function loadStats() {
    setLoading(true)
    try {
      const [tenantsCountRes, roomsRes, monthBillsRes, activeTenantsRes] = await Promise.all([
        supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
        supabase
          .from('bills')
          .select(
            'tenant_id, rent_amount, electricity_amount, amount_paid, remaining_due, status, previous_due, other_charge, discount, total_bill, billing_month'
          )
          .eq('billing_month', month),
        supabase.from('tenants').select('id, full_name').eq('active', true).order('full_name'),
      ])

      const monthBills = (monthBillsRes.data || []) as BillLite[]
      let totalRent = 0
      let totalEC = 0
      let totalCollected = 0
      let monthDue = 0
      let unpaidCount = 0
      monthBills.forEach((b) => {
        totalRent += Number(b.rent_amount) || 0
        totalEC += Number(b.electricity_amount) || 0
        totalCollected += Number(b.amount_paid) || 0
        monthDue += Number(b.remaining_due) || 0
        if (b.status === 'unpaid' || b.status === 'partial') unpaidCount++
      })

      const activeTenants = activeTenantsRes.data || []
      const tenantIds = activeTenants.map((t) => t.id)

      let allBills: BillLite[] = []
      if (tenantIds.length) {
        const { data } = await supabase
          .from('bills')
          .select(
            'tenant_id, billing_month, remaining_due, previous_due, rent_amount, electricity_amount, other_charge, discount, total_bill, amount_paid'
          )
          .in('tenant_id', tenantIds)
          .order('billing_month', { ascending: true })
        allBills = (data || []) as BillLite[]
      }

      const billsByTenant: Record<string, BillLite[]> = {}
      allBills.forEach((b) => {
        if (!billsByTenant[b.tenant_id]) billsByTenant[b.tenant_id] = []
        billsByTenant[b.tenant_id].push(b)
      })

      const monthBillByTenant: Record<string, BillLite> = {}
      monthBills.forEach((b) => {
        monthBillByTenant[b.tenant_id] = b
      })

      let allOutstanding = 0
      let tenantsWithDue = 0
      const rows: TenantDueRow[] = []

      activeTenants.forEach((t) => {
        const list = billsByTenant[t.id] || []
        const { amount, note, latest } = tenantTrueOutstanding(list)
        allOutstanding += amount
        if (amount > 0.009) tenantsWithDue++

        const monthBill = monthBillByTenant[t.id]
        const display = monthBill || latest

        rows.push({
          tenant_id: t.id,
          full_name: t.full_name,
          latest_month: latest?.billing_month || null,
          previous_due: Number(display?.previous_due) || 0,
          rent_amount: Number(display?.rent_amount) || 0,
          electricity_amount: Number(display?.electricity_amount) || 0,
          amount_paid: Number(display?.amount_paid) || 0,
          total_bill: Number(display?.total_bill) || 0,
          remaining_due: amount,
          has_month_bill: !!monthBill,
          carry_note: note,
        })
      })

      rows.sort((a, b) => b.remaining_due - a.remaining_due)
      allOutstanding = Math.round(allOutstanding * 100) / 100

      setDueRows(rows)
      setStats({
        tenants: tenantsCountRes.count || 0,
        rooms: roomsRes.count || 0,
        totalRent,
        totalEC,
        totalCollected,
        monthDue: Math.round(monthDue * 100) / 100,
        allOutstanding,
        unpaidCount,
        tenantsWithDue,
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
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[d.getMonth()]} ${d.getFullYear()}`
  })()

  const reportTotal = Math.round(dueRows.reduce((s, r) => s + r.remaining_due, 0) * 100) / 100

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Home Rent Status</h1>
            <div className="sub">Welcome, {profile?.full_name || 'Admin'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={toggle} style={{ padding: '8px 10px' }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button type="button" className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 12px' }}>
              Logout
            </button>
          </div>
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
          <div className="empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            লোড হচ্ছে...
          </div>
        ) : (
          <>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="sum-card due">
                <div className="label">All Outstanding</div>
                <div className="value">৳{fmtBDT(stats.allOutstanding)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>
                  Real unpaid · no double count
                </div>
              </div>
              <div className="sum-card orange">
                <div className="label">This Month Due</div>
                <div className="value">৳{fmtBDT(stats.monthDue)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 4 }}>{monthLabel} bills only</div>
              </div>
            </div>

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
                <div className="label">Collected (month)</div>
                <div className="value">৳{fmtBDT(stats.totalCollected)}</div>
              </div>
              <div className="sum-card">
                <div className="label">Tenants with due</div>
                <div className="value">{stats.tenantsWithDue}</div>
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
              <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--primary)' }}>
                Unpaid / Partial this month: {stats.unpaidCount} bill(s)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                All Outstanding (৳{fmtBDT(stats.allOutstanding)}) must match report total (৳{fmtBDT(reportTotal)}).
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
                Tenant-wise outstanding
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10 }}>
                Orphan old dues (not in next bill P.Due) are included. Fully carried dues count once on the latest bill.
              </div>
              {dueRows.length === 0 ? (
                <div className="empty" style={{ padding: 12 }}>
                  No active tenants
                </div>
              ) : (
                dueRows.map((r) => (
                  <div key={r.tenant_id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{r.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                          {r.latest_month ? formatMonth(r.latest_month) : 'No bill'}
                          {!r.has_month_bill && r.latest_month ? ' · no bill this month' : ''}
                          {' · '}
                          {r.carry_note}
                        </div>
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: r.remaining_due > 0 ? 'var(--danger)' : 'var(--accent)',
                        }}
                      >
                        ৳{fmtBDT(r.remaining_due)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                        marginTop: 4,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 2,
                      }}
                    >
                      <span>P.Due: ৳{fmtBDT(r.previous_due)}</span>
                      <span>Rent: ৳{fmtBDT(r.rent_amount)}</span>
                      <span>EC: ৳{fmtBDT(r.electricity_amount)}</span>
                      <span>Paid: ৳{fmtBDT(r.amount_paid)}</span>
                      <span>Total bill: ৳{fmtBDT(r.total_bill)}</span>
                    </div>
                  </div>
                ))
              )}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '2px solid var(--border)',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Report total (= All Outstanding)</span>
                <span style={{ color: 'var(--danger)' }}>৳{fmtBDT(reportTotal)}</span>
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          <Link to="/admin/bills" className="btn btn-primary" style={{ padding: 14 }}>
            📋 Monthly Bills
          </Link>
          <Link to="/admin/tenants" className="btn btn-primary" style={{ padding: 14 }}>
            👥 Tenants
          </Link>
          <Link to="/admin/reminders" className="btn btn-primary" style={{ padding: 14 }}>
            🔔 Payment Reminders
          </Link>
          <Link to="/admin/reports" className="btn btn-primary" style={{ padding: 14 }}>
            📈 Income & Expense
          </Link>
        </div>
      </div>

      <div className="bottom-nav">
        <button type="button" className="nav-item active">
          <span className="icon">📊</span>Dashboard
        </button>
        <Link to="/admin/bills" className="nav-item">
          <span className="icon">📋</span>Bills
        </Link>
        <Link to="/admin/tenants" className="nav-item">
          <span className="icon">👥</span>Tenants
        </Link>
        <Link to="/admin/reminders" className="nav-item">
          <span className="icon">🔔</span>Remind
        </Link>
      </div>
    </div>
  )
}
