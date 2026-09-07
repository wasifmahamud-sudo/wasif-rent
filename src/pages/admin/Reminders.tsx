import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'

type Status = 'upcoming' | 'due_today' | 'overdue' | 'paid'

type ReminderRow = {
  bill_id: string
  tenant_id: string
  tenant_name: string
  phone: string
  room_number: string
  house_id: string
  house_name: string
  remaining_due: number
  amount_paid: number
  total_bill: number
  billing_month: string
  due_date: string | null
  status: Status
}

interface House {
  id: string
  name: string
}

function toWhatsAppNumber(phone: string): string | null {
  if (!phone) return null
  let d = phone.replace(/[^\d]/g, '')
  if (d.startsWith('880') && d.length >= 13) return d
  if (d.startsWith('0') && d.length === 11) return '88' + d
  if (d.startsWith('1') && d.length === 10) return '880' + d
  if (d.length >= 10) return d
  return null
}

function toLocalPhone(phone: string): string | null {
  if (!phone) return null
  let d = phone.replace(/[^\d]/g, '')
  if (d.startsWith('880') && d.length >= 13) return '0' + d.slice(3)
  if (d.startsWith('0') && d.length === 11) return d
  if (d.startsWith('1') && d.length === 10) return '0' + d
  return d || null
}

function parseDateOnly(s: string | null): Date | null {
  if (!s) return null
  const part = s.slice(0, 10)
  const [y, m, d] = part.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function todayLocal(): Date {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

function effectiveDueDate(billingMonth: string, dueDate: string | null): Date | null {
  const explicit = parseDateOnly(dueDate)
  if (explicit) return explicit
  const bm = parseDateOnly(billingMonth)
  if (!bm) return null
  const last = new Date(bm.getFullYear(), bm.getMonth() + 1, 0)
  last.setHours(0, 0, 0, 0)
  return last
}

function computeStatus(remainingDue: number, due: Date | null, today: Date): Status {
  if (remainingDue <= 0) return 'paid'
  if (!due) return 'overdue'
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'due_today'
  if (diffDays <= 3) return 'upcoming'
  return 'upcoming'
}

function buildMessage(r: ReminderRow): string {
  const monthLabel = formatMonth(r.billing_month)
  const dueLabel = r.due_date
    ? r.due_date.slice(0, 10)
    : effectiveDueDate(r.billing_month, r.due_date)?.toISOString().slice(0, 10) || 'N/A'

  return (
    `Dear ${r.tenant_name},\n\n` +
    `Assalamu Alaikum.\n` +
    `Your rent/bill for ${monthLabel} is due.\n\n` +
    `House: ${r.house_name}\n` +
    `Room: ${r.room_number}\n` +
    `Total bill: ৳${fmtBDT(r.total_bill)}\n` +
    `Paid: ৳${fmtBDT(r.amount_paid)}\n` +
    `Total due: ৳${fmtBDT(r.remaining_due)}\n` +
    `Due date: ${dueLabel}\n\n` +
    `Please make the payment on time.\n` +
    `bKash / Nagad: +8801743131165\n` +
    `After payment, please share the statement on WhatsApp.\n\n` +
    `Thank you.\n` +
    `— Home Rent Status`
  )
}

const STATUS_LABEL: Record<Status, string> = {
  upcoming: 'Upcoming',
  due_today: 'Due Today',
  overdue: 'Overdue',
  paid: 'Paid',
}

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  upcoming: { bg: '#e8f4fd', color: '#2980b9' },
  due_today: { bg: '#fff4e0', color: '#d68910' },
  overdue: { bg: '#fde8e8', color: '#c0392b' },
  paid: { bg: '#e8f8f0', color: '#0d8050' },
}

export default function AdminReminders() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [houses, setHouses] = useState<House[]>([])
  const [houseFilter, setHouseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ReminderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2200)
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [billsRes, housesRes] = await Promise.all([
        supabase
          .from('bills')
          .select('id, tenant_id, room_id, billing_month, remaining_due, amount_paid, total_bill, due_date')
          .eq('billing_month', month),
        supabase.from('houses').select('id, name').order('name'),
      ])

      if (billsRes.error) throw billsRes.error
      setHouses(housesRes.data || [])

      const bills = billsRes.data || []
      if (!bills.length) {
        setRows([])
        setLoading(false)
        return
      }

      const tenantIds = [...new Set(bills.map((b) => b.tenant_id))]
      const roomIds = [...new Set(bills.map((b) => b.room_id))]

      const [tenantsRes, roomsRes] = await Promise.all([
        supabase.from('tenants').select('id, full_name, phone').in('id', tenantIds),
        supabase.from('rooms').select('id, room_number, house_id').in('id', roomIds),
      ])

      const tMap: Record<string, { full_name: string; phone: string | null }> = {}
      ;(tenantsRes.data || []).forEach((t) => {
        tMap[t.id] = t
      })
      const rMap: Record<string, { room_number: string; house_id: string }> = {}
      ;(roomsRes.data || []).forEach((r) => {
        rMap[r.id] = r
      })
      const hMap: Record<string, string> = {}
      ;(housesRes.data || []).forEach((h) => {
        hMap[h.id] = h.name
      })

      const today = todayLocal()

      const built: ReminderRow[] = bills.map((b) => {
        const t = tMap[b.tenant_id]
        const r = rMap[b.room_id]
        const dueAmt = Number(b.remaining_due || 0)
        const dueDt = effectiveDueDate(b.billing_month, b.due_date)
        const status = computeStatus(dueAmt, dueDt, today)

        return {
          bill_id: b.id,
          tenant_id: b.tenant_id,
          tenant_name: t?.full_name || '—',
          phone: t?.phone || '',
          room_number: r?.room_number || '—',
          house_id: r?.house_id || '',
          house_name: r ? hMap[r.house_id] || '' : '',
          remaining_due: dueAmt,
          amount_paid: Number(b.amount_paid || 0),
          total_bill: Number(b.total_bill || 0),
          billing_month: b.billing_month,
          due_date: b.due_date || (dueDt ? dueDt.toISOString().slice(0, 10) : null),
          status,
        }
      })

      const order: Record<Status, number> = {
        overdue: 0,
        due_today: 1,
        upcoming: 2,
        paid: 3,
      }
      built.sort(
        (a, b) => order[a.status] - order[b.status] || b.remaining_due - a.remaining_due
      )

      setRows(built)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load reminders')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (houseFilter && r.house_id !== houseFilter) return false
      if (q) {
        const hay = `${r.tenant_name} ${r.phone} ${r.room_number} ${r.house_name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, statusFilter, houseFilter, search])

  const summary = useMemo(() => {
    const upcoming = rows.filter((r) => r.status === 'upcoming')
    const dueToday = rows.filter((r) => r.status === 'due_today')
    const overdue = rows.filter((r) => r.status === 'overdue')
    const withDue = rows.filter((r) => r.remaining_due > 0)
    return {
      upcomingCount: upcoming.length,
      upcomingAmount: upcoming.reduce((s, r) => s + r.remaining_due, 0),
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, r) => s + r.remaining_due, 0),
      outstanding: withDue.reduce((s, r) => s + r.remaining_due, 0),
      tenantsWithDue: withDue.length,
    }
  }, [rows])

  const copyMsg = async (r: ReminderRow) => {
    const msg = buildMessage(r)
    try {
      await navigator.clipboard.writeText(msg)
      setCopiedId(r.bill_id)
      showToast('Message copied')
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = msg
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedId(r.bill_id)
      showToast('Message copied')
      setTimeout(() => setCopiedId(''), 2000)
    }
  }

  const openWhatsApp = (r: ReminderRow) => {
    const wa = toWhatsAppNumber(r.phone)
    if (!wa) {
      showToast('Phone number missing or invalid')
      return
    }
    const msg = encodeURIComponent(buildMessage(r))
    window.open(`https://wa.me/${wa}?text=${msg}`, '_blank', 'noopener,noreferrer')
  }

  const openSms = (r: ReminderRow) => {
    const local = toLocalPhone(r.phone)
    if (!local) {
      showToast('Phone number missing or invalid')
      return
    }
    const msg = encodeURIComponent(buildMessage(r))
    window.location.href = `sms:${local}?body=${msg}`
  }

  return (
    <div>
      <div className="app-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h1>Rent Reminders</h1>
            <div className="sub">{formatMonth(month)}</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>
            ← Dashboard
          </Link>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value + '-01')}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: 'white',
              fontWeight: 600,
            }}
          />
        </div>
      </div>

      <div className="page-content">
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div className="sum-card blue">
            <div className="label">Upcoming</div>
            <div className="value">{summary.upcomingCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
              ৳{fmtBDT(summary.upcomingAmount)}
            </div>
          </div>
          <div className="sum-card orange">
            <div className="label">Due Today</div>
            <div className="value">{summary.dueTodayCount}</div>
          </div>
          <div className="sum-card due">
            <div className="label">Overdue</div>
            <div className="value">{summary.overdueCount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
              ৳{fmtBDT(summary.overdueAmount)}
            </div>
          </div>
          <div className="sum-card">
            <div className="label">Outstanding / Tenants</div>
            <div className="value">৳{fmtBDT(summary.outstanding)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
              {summary.tenantsWithDue} tenants with due
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'All'],
              ['upcoming', 'Upcoming'],
              ['due_today', 'Due Today'],
              ['overdue', 'Overdue'],
              ['paid', 'Paid'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className="btn"
              onClick={() => setStatusFilter(key)}
              style={{
                padding: '7px 12px',
                borderRadius: 20,
                fontSize: '0.75rem',
                background: statusFilter === key ? 'var(--primary)' : 'white',
                color: statusFilter === key ? 'white' : 'var(--muted)',
                border: '1.5px solid var(--border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            value={houseFilter}
            onChange={(e) => setHouseFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid var(--border)',
              fontWeight: 600,
            }}
          >
            <option value="">All houses</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search name, phone, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 2,
              minWidth: 160,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid var(--border)',
            }}
          />
        </div>

        {loading ? (
          <div className="empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            লোড হচ্ছে...
          </div>
        ) : error ? (
          <div className="login-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            কোনো reminder নেই।
            <br />
            <span style={{ fontSize: '0.85rem' }}>
              এই মাসের বিল Save / Generate Month করুন, অথবা ফিল্টার বদলান।
            </span>
          </div>
        ) : (
          filtered.map((r) => {
            const st = STATUS_STYLE[r.status]
            return (
              <div key={r.bill_id} className="card" style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.05rem' }}>
                      {r.tenant_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                      {r.house_name} · Room {r.room_number}
                      {r.phone ? ` · ${r.phone}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: st.bg,
                      color: st.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    marginTop: 10,
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    Month: <strong>{formatMonth(r.billing_month)}</strong>
                  </div>
                  <div>
                    Due date: <strong>{r.due_date ? r.due_date.slice(0, 10) : '—'}</strong>
                  </div>
                  <div>
                    Total: <strong>৳{fmtBDT(r.total_bill)}</strong>
                  </div>
                  <div>
                    Paid: <strong style={{ color: 'var(--accent)' }}>৳{fmtBDT(r.amount_paid)}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    Remaining due:{' '}
                    <strong style={{ color: r.remaining_due > 0 ? '#c0392b' : 'var(--accent)', fontSize: '1rem' }}>
                      ৳{fmtBDT(r.remaining_due)}
                    </strong>
                  </div>
                </div>

                {r.remaining_due > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, minWidth: 100, padding: 10, fontSize: '0.8rem' }}
                      onClick={() => copyMsg(r)}
                    >
                      {copiedId === r.bill_id ? '✓ Copied' : '📋 Copy'}
                    </button>
                    <button
                      className="btn btn-success"
                      style={{ flex: 1, minWidth: 100, padding: 10, fontSize: '0.8rem' }}
                      onClick={() => openWhatsApp(r)}
                    >
                      WhatsApp
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, minWidth: 100, padding: 10, fontSize: '0.8rem' }}
                      onClick={() => openSms(r)}
                    >
                      SMS
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}

      <div className="bottom-nav">
        <Link to="/admin" className="nav-item">
          <span className="icon">📊</span>Dashboard
        </Link>
        <Link to="/admin/bills" className="nav-item">
          <span className="icon">📋</span>Bills
        </Link>
        <Link to="/admin/reports" className="nav-item">
          <span className="icon">📈</span>Reports
        </Link>
        <button className="nav-item active">
          <span className="icon">🔔</span>Remind
        </button>
      </div>
    </div>
  )
}
