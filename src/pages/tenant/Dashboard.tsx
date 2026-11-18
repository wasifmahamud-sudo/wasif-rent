import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'
import type { Bill, Payment } from '../../types/database'

type MeterRow = {
  id: string
  billing_month: string
  previous_reading: number | null
  current_reading: number | null
  units_used: number | null
}

type BillHistory = Pick<
  Bill,
  | 'id'
  | 'billing_month'
  | 'rent_amount'
  | 'electricity_units'
  | 'electricity_rate'
  | 'electricity_amount'
  | 'amount_paid'
  | 'remaining_due'
  | 'status'
  | 'total_bill'
  | 'previous_due'
>

export default function TenantDashboard() {
  const { profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const [bill, setBill] = useState<Bill | null>(null)
  const [billHistory, setBillHistory] = useState<BillHistory[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [meters, setMeters] = useState<MeterRow[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [deposit, setDeposit] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bkash, setBkash] = useState('')
  const [nagad, setNagad] = useState('')
  const [bank, setBank] = useState('')
  const [payNote, setPayNote] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [notices, setNotices] = useState<
    { id: string; title: string; body: string; is_important: boolean; published_at: string; expiry_date: string | null }[]
  >([])
  const [myComplaints, setMyComplaints] = useState<
    { id: string; subject: string; category: string; description: string; status: string; admin_reply: string | null; created_at: string }[]
  >([])
  const [cSubject, setCSubject] = useState('')
  const [cCategory, setCCategory] = useState('Other')
  const [cDesc, setCDesc] = useState('')
  const [cPhoto, setCPhoto] = useState('')
  const [cSaving, setCSaving] = useState(false)
  const [cMsg, setCMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['bkash_number', 'nagad_number', 'bank_account', 'payment_note'])
      if (settings) {
        settings.forEach((s) => {
          const v = typeof s.value === 'string' ? s.value.replace(/^"|"$/g, '') : String(s.value ?? '')
          if (s.key === 'bkash_number') setBkash(v)
          if (s.key === 'nagad_number') setNagad(v)
          if (s.key === 'bank_account') setBank(v)
          if (s.key === 'payment_note') setPayNote(v)
        })
      }

      const uid = (await supabase.auth.getUser()).data.user?.id
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('id, room_id, full_name, deposit')
        .eq('user_id', uid)
        .eq('active', true)
        .maybeSingle()

      if (tErr || !tenant) {
        setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
        setLoading(false)
        return
      }

      if (tenant.deposit != null) setDeposit(Number(tenant.deposit))
      setTenantId(tenant.id)

      const { data: noticeData } = await supabase
        .from('notices')
        .select('id, title, body, is_important, published_at, expiry_date')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(20)
      const today = new Date().toISOString().slice(0, 10)
      setNotices(
        ((noticeData || []) as {
          id: string
          title: string
          body: string
          is_important: boolean
          published_at: string
          expiry_date: string | null
        }[]).filter((n) => !n.expiry_date || n.expiry_date >= today)
      )

      const { data: compData } = await supabase
        .from('complaints')
        .select('id, subject, category, description, status, admin_reply, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setMyComplaints(
        (compData as {
          id: string
          subject: string
          category: string
          description: string
          status: string
          admin_reply: string | null
          created_at: string
        }[]) || []
      )

      if (tenant.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('room_number')
          .eq('id', tenant.room_id)
          .single()
        if (room) setRoomNumber(room.room_number)

        const { data: mr } = await supabase
          .from('meter_readings')
          .select('id, billing_month, previous_reading, current_reading, units_used')
          .eq('room_id', tenant.room_id)
          .order('billing_month', { ascending: false })
          .limit(6)
        setMeters(mr || [])
      }

      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: thisMonthBill } = await supabase
        .from('bills')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('billing_month', thisMonth)
        .maybeSingle()

      const { data: allBills } = await supabase
        .from('bills')
        .select(
          'id, billing_month, rent_amount, electricity_units, electricity_rate, electricity_amount, amount_paid, remaining_due, status, total_bill, previous_due'
        )
        .eq('tenant_id', tenant.id)
        .order('billing_month', { ascending: false })
        .limit(12)

      setBillHistory(allBills || [])
      setBill(thisMonthBill || (allBills && allBills[0]) || null)

      const { data: pays } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false })
        .limit(30)
      setPayments(pays || [])
    } catch (e: any) {
      setError(e.message || 'ডেটা লোড করতে সমস্যা')
    } finally {
      setLoading(false)
    }
  }

  const submitComplaint = async () => {
    if (!tenantId) {
      setCMsg('টেন্যান্ট অ্যাকাউন্ট লিংক নেই')
      return
    }
    if (!cSubject.trim() || !cDesc.trim()) {
      setCMsg('Subject ও Description দিন')
      return
    }
    setCSaving(true)
    setCMsg('')
    const { error: cErr } = await supabase.from('complaints').insert({
      tenant_id: tenantId,
      subject: cSubject.trim(),
      category: cCategory,
      description: cDesc.trim(),
      photo_url: cPhoto.trim() || null,
      status: 'New',
    })
    setCSaving(false)
    if (cErr) {
      setCMsg(cErr.message)
      return
    }
    setCSubject('')
    setCDesc('')
    setCPhoto('')
    setCCategory('Other')
    setCMsg('Complaint জমা হয়েছে')
    const { data: compData } = await supabase
      .from('complaints')
      .select('id, subject, category, description, status, admin_reply, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30)
    setMyComplaints(
      (compData as {
        id: string
        subject: string
        category: string
        description: string
        status: string
        admin_reply: string | null
        created_at: string
      }[]) || []
    )
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  function unitsFor(m: MeterRow): number | null {
    if (m.units_used != null && !Number.isNaN(Number(m.units_used))) return Number(m.units_used)
    if (m.current_reading != null && m.previous_reading != null) {
      const u = Number(m.current_reading) - Number(m.previous_reading)
      return u >= 0 ? u : null
    }
    return null
  }

  function usageDelta(idx: number): { text: string; up: boolean | null } {
    if (idx >= meters.length - 1) return { text: '—', up: null }
    const cur = unitsFor(meters[idx])
    const prev = unitsFor(meters[idx + 1])
    if (cur == null || prev == null) return { text: 'Reading unavailable', up: null }
    const d = cur - prev
    if (d === 0) return { text: 'Same as previous month', up: null }
    if (d > 0) return { text: `+${d} units vs previous`, up: true }
    return { text: `${d} units vs previous`, up: false }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Tenant'}
            </h1>
            <div className="sub">{roomNumber ? `Room: ${roomNumber}` : 'Tenant Portal'} · Read-only</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" className="btn btn-outline" onClick={toggle} style={{ padding: '8px 10px' }} title="Theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button type="button" className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 12px' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="grid-2" style={{ marginBottom: 14 }}>
          <div className="sum-card due">
            <div className="label">Outstanding</div>
            <div className="value">৳{fmtBDT(bill?.remaining_due ?? 0)}</div>
          </div>
          <div className="sum-card green">
            <div className="label">Paid (this bill)</div>
            <div className="value">৳{fmtBDT(bill?.amount_paid ?? 0)}</div>
          </div>
          {deposit != null && (
            <div className="sum-card blue">
              <div className="label">Deposit</div>
              <div className="value">৳{fmtBDT(deposit)}</div>
            </div>
          )}
          <div className="sum-card orange">
            <div className="label">Status</div>
            <div className="value" style={{ fontSize: '1rem', textTransform: 'capitalize' }}>
              {bill?.status || '—'}
            </div>
          </div>
        </div>

        {/* Notices — TOP */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>📢 Notices</div>
          {notices.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>কোনো নতুন notice নেই</div>
          ) : (
            notices.map((n) => {
              const isNew = Date.now() - new Date(n.published_at).getTime() < 7 * 24 * 60 * 60 * 1000
              return (
                <div
                  key={n.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    padding: '10px 0',
                    borderLeft: n.is_important ? '3px solid var(--danger)' : undefined,
                    paddingLeft: n.is_important ? 8 : 0,
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {n.is_important ? '⭐ ' : ''}
                    {n.title}
                    {isNew && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.65rem',
                          background: 'var(--danger)',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontWeight: 700,
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
                    {new Date(n.published_at).toLocaleDateString()}
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>{n.body}</div>
                </div>
              )
            })
          )}
        </div>

        {(bkash || nagad || bank) && (
          <div className="card pay-info-card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>💳 টাকা পাঠাবেন এখানে</div>
            {bkash && (
              <div className="bill-row"><span>bKash</span><span style={{ fontWeight: 800 }}>{bkash}</span></div>
            )}
            {nagad && (
              <div className="bill-row"><span>Nagad</span><span style={{ fontWeight: 800 }}>{nagad}</span></div>
            )}
            {bank && (
              <div className="bill-row">
                <span>Bank</span>
                <span style={{ fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{bank}</span>
              </div>
            )}
            {payNote && (
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 10, lineHeight: 1.45, fontWeight: 600 }}>
                {payNote}
              </div>
            )}
          </div>
        )}

        {bill ? (
          <div className="bill-card" style={{ marginBottom: 16 }}>
            <div className="bill-header">Current Bill — {formatMonth(bill.billing_month)}</div>
            <div className="bill-row"><span>Room</span><span style={{ fontWeight: 700 }}>{roomNumber || '—'}</span></div>
            <div className="bill-row"><span>Monthly Rent</span><span>৳{fmtBDT(bill.rent_amount)}</span></div>
            <div className="bill-row"><span>Electricity Units</span><span>{bill.electricity_units} Units</span></div>
            <div className="bill-row"><span>Rate</span><span>৳{fmtBDT(bill.electricity_rate)}/unit</span></div>
            <div className="bill-row"><span>Electricity Bill</span><span>৳{fmtBDT(bill.electricity_amount)}</span></div>
            <div className="bill-row"><span>Previous Due</span><span>৳{fmtBDT(bill.previous_due)}</span></div>
            <div className="bill-row total"><span>Total Bill</span><span>৳{fmtBDT(bill.total_bill)}</span></div>
            <div className="bill-row paid-row"><span>Paid</span><span>৳{fmtBDT(bill.amount_paid)}</span></div>
            <div className={`bill-row ${Number(bill.remaining_due) > 0 ? 'due-row' : 'paid-row'}`}>
              <span>Remaining Due</span>
              <span>৳{fmtBDT(bill.remaining_due)}</span>
            </div>
          </div>
        ) : (
          !error && <div className="empty" style={{ marginBottom: 16 }}>এখনো কোনো বিল তৈরি হয়নি</div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>⚡ My Electricity Usage</div>
          {meters.length > 0 ? (
            meters.map((m, idx) => {
              const units = unitsFor(m)
              const delta = usageDelta(idx)
              return (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                  <div style={{ fontWeight: 700 }}>{formatMonth(m.billing_month)}</div>
                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    Prev: <strong>{m.previous_reading ?? '—'}</strong> · New:{' '}
                    <strong>{m.current_reading ?? '—'}</strong> · Units: <strong>{units ?? '—'}</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>{delta.text}</div>
                </div>
              )
            })
          ) : billHistory.length > 0 ? (
            billHistory.slice(0, 4).map((b, idx, arr) => {
              const next = arr[idx + 1]
              let cmp = '—'
              if (next) {
                const d = Number(b.electricity_units) - Number(next.electricity_units)
                if (d > 0) cmp = `+${d} units vs previous`
                else if (d < 0) cmp = `${d} units vs previous`
                else cmp = 'Same as previous month'
              }
              return (
                <div key={b.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                  <div style={{ fontWeight: 700 }}>{formatMonth(b.billing_month)}</div>
                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    Units: <strong>{b.electricity_units}</strong> · ৳{fmtBDT(b.electricity_amount)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{cmp}</div>
                </div>
              )
            })
          ) : (
            <div className="empty" style={{ padding: 12 }}>No usage data</div>
          )}
        </div>

        {billHistory.length > 1 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>📋 Bill history</div>
            {billHistory.map((b) => (
              <div key={b.id} className="bill-row" style={{ padding: '10px 0', flexWrap: 'wrap', gap: 4 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{formatMonth(b.billing_month)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    Rent ৳{fmtBDT(b.rent_amount)} · EC ৳{fmtBDT(b.electricity_amount)} · {b.status}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: Number(b.remaining_due) > 0 ? 'var(--danger)' : 'var(--accent)' }}>
                    Due ৳{fmtBDT(b.remaining_due)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Paid ৳{fmtBDT(b.amount_paid)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>💰 Payment history</div>
          {payments.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>No payments yet</div>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="bill-row" style={{ padding: '10px 0' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.payment_date}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {p.payment_method}
                    {p.transaction_reference ? ` · ${p.transaction_reference}` : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--accent)' }}>৳{fmtBDT(p.amount)}</div>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>🛠️ Complaint Box</div>
          <div className="field">
            <label>Subject</label>
            <input value={cSubject} onChange={(e) => setCSubject(e.target.value)} placeholder="সমস্যার শিরোনাম" />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={cCategory} onChange={(e) => setCCategory(e.target.value)}>
              {['Water', 'Electricity', 'Plumbing', 'Bathroom', 'Maintenance', 'Security', 'Other'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows={3}
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              placeholder="বিস্তারিত লিখুন..."
              style={{
                width: '100%',
                padding: 11,
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'var(--input-bg, var(--yellow))',
                color: 'var(--input-text, #333)',
              }}
            />
          </div>
          <div className="field">
            <label>Photo URL (optional)</label>
            <input value={cPhoto} onChange={(e) => setCPhoto(e.target.value)} placeholder="https://..." />
          </div>
          {cMsg && (
            <div style={{ marginBottom: 10, fontWeight: 600, color: cMsg.includes('জমা') ? 'var(--accent)' : 'var(--danger)' }}>
              {cMsg}
            </div>
          )}
          <button type="button" className="btn btn-primary" disabled={cSaving || !tenantId} onClick={submitComplaint}>
            {cSaving ? 'Submitting...' : 'Submit complaint'}
          </button>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>My complaints</div>
          {myComplaints.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>এখনো কোনো complaint নেই</div>
          ) : (
            myComplaints.map((c) => (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <div style={{ fontWeight: 800 }}>{c.subject}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {c.category} · {c.status} · {new Date(c.created_at).toLocaleDateString()}
                </div>
                <div style={{ marginTop: 4, fontSize: '0.85rem' }}>{c.description}</div>
                {c.admin_reply && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'var(--green)', fontSize: '0.85rem' }}>
                    <strong>Admin:</strong> {c.admin_reply}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
