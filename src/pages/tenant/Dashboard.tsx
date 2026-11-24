import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
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

type Notice = {
  id: string
  title: string
  body: string
  is_important: boolean
  published_at: string
  expiry_date: string | null
}

function calculateTotalOutstanding(bills: BillHistory[]): number {
  if (!bills || bills.length === 0) return 0

  const sorted = [...bills].sort((a, b) =>
    String(a.billing_month).localeCompare(String(b.billing_month))
  )

  let total = 0

  for (let i = 0; i < sorted.length; i++) {
    const currentDue = Math.max(0, Number(sorted[i].remaining_due) || 0)

    if (i < sorted.length - 1) {
      const nextPrevDue = Math.max(0, Number(sorted[i + 1].previous_due) || 0)
      const carried = Math.min(currentDue, nextPrevDue)
      const orphan = Math.round((currentDue - carried) * 100) / 100

      if (orphan > 0.009) {
        total += orphan
      }
    } else {
      total += Math.max(0, currentDue)
    }
  }

  return Math.round(total * 100) / 100
}

export default function TenantDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [bill, setBill] = useState<Bill | null>(null)
  const [billHistory, setBillHistory] = useState<BillHistory[]>([])
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [currentMonthDue, setCurrentMonthDue] = useState(0)
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
  const [notices, setNotices] = useState<Notice[]>([])
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const { data: settings, error: settingsErr } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['bkash_number', 'nagad_number', 'bank_account', 'payment_note'])

      if (settingsErr) throw settingsErr

      if (settings) {
        settings.forEach((s) => {
          const v =
            typeof s.value === 'string'
              ? s.value.replace(/^"|"$/g, '')
              : String(s.value ?? '')

          if (s.key === 'bkash_number') setBkash(v)
          if (s.key === 'nagad_number') setNagad(v)
          if (s.key === 'bank_account') setBank(v)
          if (s.key === 'payment_note') setPayNote(v)
        })
      }

      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr

      const uid = authData.user?.id

      if (!uid) {
        setError('আপনার অ্যাকাউন্ট পাওয়া যায়নি। আবার লগইন করুন।')
        return
      }

      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('id, room_id, full_name, deposit')
        .eq('user_id', uid)
        .eq('active', true)
        .maybeSingle()

      if (tErr || !tenant) {
        setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
        return
      }

      if (tenant.deposit != null) {
        setDeposit(Number(tenant.deposit))
      }

      const { data: noticeData, error: noticeErr } = await supabase
        .from('notices')
        .select('id, title, body, is_important, published_at, expiry_date')
        .eq('is_active', true)
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(20)

      if (noticeErr) throw noticeErr

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      setNotices(
        ((noticeData || []) as Notice[]).filter(
          (n) => !n.expiry_date || n.expiry_date >= today
        )
      )

      if (tenant.room_id) {
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('room_number')
          .eq('id', tenant.room_id)
          .single()

        if (roomErr) throw roomErr
        if (room) setRoomNumber(room.room_number)

        const { data: mr, error: mrErr } = await supabase
          .from('meter_readings')
          .select('id, billing_month, previous_reading, current_reading, units_used')
          .eq('room_id', tenant.room_id)
          .order('billing_month', { ascending: false })
          .limit(6)

        if (mrErr) throw mrErr
        setMeters(mr || [])
      }

      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: thisMonthBill, error: thisMonthBillErr } = await supabase
        .from('bills')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('billing_month', thisMonth)
        .maybeSingle()

      if (thisMonthBillErr) throw thisMonthBillErr

      const allBillsList: BillHistory[] = []
      const pageSize = 100
      let from = 0

      while (true) {
        const { data: batch, error: billsErr } = await supabase
          .from('bills')
          .select(
            'id, billing_month, rent_amount, electricity_units, electricity_rate, electricity_amount, amount_paid, remaining_due, status, total_bill, previous_due'
          )
          .eq('tenant_id', tenant.id)
          .order('billing_month', { ascending: false })
          .range(from, from + pageSize - 1)

        if (billsErr) throw billsErr

        const rows = (batch || []) as BillHistory[]
        allBillsList.push(...rows)

        if (rows.length < pageSize) break
        from += pageSize
      }

      const latestBill = allBillsList[0] || null
      const outstandingTotal = calculateTotalOutstanding(allBillsList)
      const monthDue = thisMonthBill
        ? Math.max(0, Number(thisMonthBill.remaining_due ?? 0))
        : 0

      setTotalOutstanding(outstandingTotal)
      setCurrentMonthDue(monthDue)
      setBillHistory(allBillsList)
      setBill(thisMonthBill || latestBill || null)

      const { data: pays, error: paysErr } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false })
        .limit(30)

      if (paysErr) throw paysErr
      setPayments(pays || [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ডেটা লোড করতে সমস্যা হয়েছে'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function unitsFor(m: MeterRow): number | null {
    if (m.units_used != null && !Number.isNaN(Number(m.units_used))) {
      return Number(m.units_used)
    }

    if (m.current_reading != null && m.previous_reading != null) {
      const u = Number(m.current_reading) - Number(m.previous_reading)
      return u >= 0 ? u : null
    }

    return null
  }

  function usageDelta(idx: number): { text: string; up: boolean | null } {
    if (idx >= meters.length - 1) {
      return { text: '—', up: null }
    }

    const cur = unitsFor(meters[idx])
    const prev = unitsFor(meters[idx + 1])

    if (cur == null || prev == null) {
      return { text: 'Reading unavailable', up: null }
    }

    const d = cur - prev

    if (d === 0) return { text: 'আগের মাসের সমান', up: null }
    if (d > 0) return { text: `আগের মাসের চেয়ে ${d} ইউনিট বেশি`, up: true }

    return { text: `আগের মাসের চেয়ে ${Math.abs(d)} ইউনিট কম`, up: false }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }

  const importantNotices = notices.filter((n) => n.is_important)
  const previewNotices = [
    ...importantNotices,
    ...notices.filter((n) => !n.is_important),
  ].slice(0, 3)

  return (
    <div>
      <div className="tenant-page-heading">
        <div>
          <h1>স্বাগতম, {profile?.full_name || 'Tenant'}!</h1>
          <p>
            {roomNumber ? `Room: ${roomNumber}` : 'আপনার Tenant Dashboard'}
            {' · '}
            আপনার ভাড়া ও পেমেন্টের তথ্য
          </p>
        </div>
      </div>

      <div className="tenant-page-content-inner">
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Notice Board */}
        <div className="card tenant-notice-highlight" style={{ marginBottom: 18 }}>
          <div className="tenant-section-heading">
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                📢 Notice Board
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 3 }}>
                গুরুত্বপূর্ণ ঘোষণা ও সর্বশেষ নোটিশ
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/tenant/notices')}
            >
              সব দেখুন →
            </button>
          </div>

          {previewNotices.length === 0 ? (
            <div className="empty" style={{ padding: 14 }}>
              বর্তমানে কোনো নতুন নোটিশ নেই।
            </div>
          ) : (
            previewNotices.map((n) => {
              const isNew =
                Date.now() - new Date(n.published_at).getTime() <
                7 * 24 * 60 * 60 * 1000

              const open = expandedNoticeId === n.id

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setExpandedNoticeId(open ? null : n.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: open ? 'rgba(15,60,110,0.06)' : 'transparent',
                    padding: '12px 8px',
                    cursor: 'pointer',
                    borderLeft: n.is_important
                      ? '4px solid var(--danger)'
                      : '4px solid var(--border)',
                    borderRadius: 7,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                      {n.is_important ? '⭐ ' : ''}
                      {n.title}

                      {isNew && (
                        <span
                          style={{
                            marginLeft: 7,
                            fontSize: '0.62rem',
                            background: 'var(--danger)',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: 5,
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>

                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                      {open ? '▲' : '▼'}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--muted)',
                      marginTop: 4,
                    }}
                  >
                    {new Date(n.published_at).toLocaleDateString()}
                    {!open && n.body
                      ? ` · ${n.body.slice(0, 65)}${n.body.length > 65 ? '…' : ''}`
                      : ''}
                  </div>

                  {open && (
                    <div
                      style={{
                        marginTop: 9,
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.88rem',
                        lineHeight: 1.6,
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                </button>
              )
            })
          )}

          {notices.length > 3 && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => navigate('/tenant/notices')}
            >
              আরও {notices.length - 3}টি নোটিশ দেখুন
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>
            ⚡ Quick Actions
          </div>

          <div className="tenant-quick-actions">
            <button type="button" onClick={() => navigate('/tenant/bills')}>
              <span>🧾</span>
              <strong>My Bills</strong>
              <small>বিল দেখুন</small>
            </button>

            <button type="button" onClick={() => navigate('/tenant/payments')}>
              <span>💰</span>
              <strong>Payments</strong>
              <small>পেমেন্ট হিস্ট্রি</small>
            </button>

            <button type="button" onClick={() => navigate('/tenant/receipts')}>
              <span>📄</span>
              <strong>Receipts</strong>
              <small>রসিদ ও PDF</small>
            </button>

            <button type="button" onClick={() => navigate('/tenant/complaints')}>
              <span>🛠️</span>
              <strong>Complaints</strong>
              <small>সমস্যা জানান</small>
            </button>

            <button type="button" onClick={() => navigate('/tenant/notices')}>
              <span>📢</span>
              <strong>Notices</strong>
              <small>সব ঘোষণা</small>
            </button>

            <button type="button" onClick={() => navigate('/tenant/profile')}>
              <span>👤</span>
              <strong>My Profile</strong>
              <small>প্রোফাইল দেখুন</small>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid-2" style={{ marginBottom: 18 }}>
          <div className="sum-card due">
            <div className="label">Total Outstanding</div>
            <div className="value">৳{fmtBDT(totalOutstanding)}</div>
          </div>

          <div className="sum-card orange">
            <div className="label">Current Month Due</div>
            <div className="value">৳{fmtBDT(currentMonthDue)}</div>
          </div>

          <div className="sum-card green">
            <div className="label">Last Payment</div>
            <div className="value" style={{ fontSize: payments[0] ? '1.05rem' : '1rem' }}>
              {payments[0] ? `৳${fmtBDT(payments[0].amount)}` : '—'}
            </div>
            {payments[0] && (
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                {payments[0].payment_date}
              </div>
            )}
          </div>

          {deposit != null ? (
            <div className="sum-card blue">
              <div className="label">Deposit</div>
              <div className="value">৳{fmtBDT(deposit)}</div>
            </div>
          ) : (
            <div className="sum-card blue">
              <div className="label">Bill Status</div>
              <div
                className="value"
                style={{ fontSize: '1rem', textTransform: 'capitalize' }}
              >
                {bill?.status || '—'}
              </div>
            </div>
          )}
        </div>

        {/* Payment Information */}
        {(bkash || nagad || bank) && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div
              style={{
                fontWeight: 800,
                color: 'var(--primary)',
                marginBottom: 10,
              }}
            >
              💳 টাকা পাঠানোর তথ্য
            </div>

            {bkash && (
              <div className="bill-row">
                <span>bKash</span>
                <strong>{bkash}</strong>
              </div>
            )}

            {nagad && (
              <div className="bill-row">
                <span>Nagad</span>
                <strong>{nagad}</strong>
              </div>
            )}

            {bank && (
              <div className="bill-row">
                <span>Bank</span>
                <strong style={{ textAlign: 'right', maxWidth: '60%' }}>
                  {bank}
                </strong>
              </div>
            )}

            {payNote && (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--muted)',
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                {payNote}
              </div>
            )}
          </div>
        )}

        {/* Current Bill */}
        {bill ? (
          <div className="bill-card" style={{ marginBottom: 18 }}>
            <div className="bill-header">
              Current Bill — {formatMonth(bill.billing_month)}
            </div>

            <div className="bill-row">
              <span>Room</span>
              <strong>{roomNumber || '—'}</strong>
            </div>

            <div className="bill-row">
              <span>Monthly Rent</span>
              <span>৳{fmtBDT(bill.rent_amount)}</span>
            </div>

            <div className="bill-row">
              <span>Electricity Units</span>
              <span>{bill.electricity_units} Units</span>
            </div>

            <div className="bill-row">
              <span>Rate</span>
              <span>৳{fmtBDT(bill.electricity_rate)}/unit</span>
            </div>

            <div className="bill-row">
              <span>Electricity Bill</span>
              <span>৳{fmtBDT(bill.electricity_amount)}</span>
            </div>

            <div className="bill-row">
              <span>Previous Due</span>
              <span>৳{fmtBDT(bill.previous_due)}</span>
            </div>

            <div className="bill-row total">
              <strong>Total Bill</strong>
              <strong>৳{fmtBDT(bill.total_bill)}</strong>
            </div>

            <div className="bill-row paid-row">
              <span>Paid</span>
              <span>৳{fmtBDT(bill.amount_paid)}</span>
            </div>

            <div
              className={`bill-row ${
                Number(bill.remaining_due) > 0 ? 'due-row' : 'paid-row'
              }`}
            >
              <strong>Remaining Due</strong>
              <strong>৳{fmtBDT(bill.remaining_due)}</strong>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 14, width: '100%' }}
              onClick={() => navigate('/tenant/bills')}
            >
              View Bill Details →
            </button>
          </div>
        ) : (
          !error && (
            <div className="empty" style={{ marginBottom: 18 }}>
              এখনো কোনো বিল তৈরি হয়নি
            </div>
          )
        )}

        {/* Electricity Usage */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div
            style={{
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 10,
            }}
          >
            ⚡ My Electricity Usage
          </div>

          {meters.length > 0 ? (
            meters.map((m, idx) => {
              const units = unitsFor(m)
              const delta = usageDelta(idx)

              return (
                <div
                  key={m.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    padding: '11px 0',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {formatMonth(m.billing_month)}
                  </div>

                  <div style={{ fontSize: '0.82rem', marginTop: 5 }}>
                    Previous Reading:{' '}
                    <strong>{m.previous_reading ?? '—'}</strong>
                    {' · '}
                    Current Reading:{' '}
                    <strong>{m.current_reading ?? '—'}</strong>
                  </div>

                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    Units Used: <strong>{units ?? '—'}</strong>
                  </div>

                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                      marginTop: 3,
                    }}
                  >
                    {delta.text}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="empty" style={{ padding: 12 }}>
              এখনো বিদ্যুতের রিডিং পাওয়া যায়নি
            </div>
          )}
        </div>

        {/* Bill History */}
        {billHistory.length > 1 && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div
              style={{
                fontWeight: 800,
                color: 'var(--primary)',
                marginBottom: 10,
              }}
            >
              📋 Bill History
            </div>

            {billHistory.map((b) => (
              <div
                key={b.id}
                className="bill-row"
                style={{ padding: '11px 0' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {formatMonth(b.billing_month)}
                  </div>

                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                    }}
                  >
                    Rent ৳{fmtBDT(b.rent_amount)}
                    {' · '}
                    Electricity ৳{fmtBDT(b.electricity_amount)}
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontWeight: 800 }}>
                  Due ৳{fmtBDT(b.remaining_due)}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => navigate('/tenant/bills')}
            >
              View All Bills →
            </button>
          </div>
        )}

        {/* Recent Payments */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div
            style={{
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 10,
            }}
          >
            💰 Recent Payments
          </div>

          {payments.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              এখনো কোনো পেমেন্ট পাওয়া যায়নি
            </div>
          ) : (
            payments.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="bill-row"
                style={{ padding: '10px 0' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.payment_date}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                    }}
                  >
                    {p.payment_method}
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: 'var(--accent)',
                  }}
                >
                  ৳{fmtBDT(p.amount)}
                </div>
              </div>
            ))
          )}

          {payments.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => navigate('/tenant/payments')}
            >
              View All Payments →
            </button>
          )}
        </div>

        {/* Payment Receipts */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 8,
            }}
          >
            🧾 Payment Receipts
          </div>

          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--muted)',
              marginBottom: 12,
            }}
          >
            আপনার পেমেন্টের রসিদ দেখুন এবং PDF ডাউনলোড করুন।
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/tenant/receipts')}
          >
            View My Receipts →
          </button>
        </div>
      </div>
    </div>
  )
}

