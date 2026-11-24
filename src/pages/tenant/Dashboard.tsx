import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'
import type { Bill, Payment } from '../../types/database'

type BillSummaryRow = Pick<
  Bill,
  | 'id'
  | 'billing_month'
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

function calculateTotalOutstanding(bills: BillSummaryRow[]): number {
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

  const [currentMonthBill, setCurrentMonthBill] = useState<BillSummaryRow | null>(null)
  const [totalOutstanding, setTotalOutstanding] = useState(0)
  const [currentMonthDue, setCurrentMonthDue] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])
  const [tenantName, setTenantName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
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
        .select('id, room_id, full_name')
        .eq('user_id', uid)
        .eq('active', true)
        .maybeSingle()

      if (tErr || !tenant) {
        setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
        return
      }

      if (tenant.full_name) {
        setTenantName(String(tenant.full_name))
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
        if (room) setRoomNumber(String(room.room_number))
      }

      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: thisMonthBill, error: thisMonthBillErr } = await supabase
        .from('bills')
        .select('id, billing_month, amount_paid, remaining_due, status, total_bill, previous_due')
        .eq('tenant_id', tenant.id)
        .eq('billing_month', thisMonth)
        .maybeSingle()

      if (thisMonthBillErr) throw thisMonthBillErr

      const allBillsList: BillSummaryRow[] = []
      const pageSize = 100
      let from = 0

      while (true) {
        const { data: batch, error: billsErr } = await supabase
          .from('bills')
          .select(
            'id, billing_month, amount_paid, remaining_due, status, total_bill, previous_due'
          )
          .eq('tenant_id', tenant.id)
          .order('billing_month', { ascending: false })
          .range(from, from + pageSize - 1)

        if (billsErr) throw billsErr

        const rows = (batch || []) as BillSummaryRow[]
        allBillsList.push(...rows)

        if (rows.length < pageSize) break
        from += pageSize
      }

      const matchedMonthBill =
        (thisMonthBill as BillSummaryRow | null) ||
        allBillsList.find((b) => String(b.billing_month).startsWith(thisMonth.slice(0, 7))) ||
        null

      const outstandingTotal = calculateTotalOutstanding(allBillsList)
      const monthDue = matchedMonthBill
        ? Math.max(0, Number(matchedMonthBill.remaining_due) || 0)
        : 0

      setCurrentMonthBill(matchedMonthBill)
      setTotalOutstanding(outstandingTotal)
      setCurrentMonthDue(monthDue)

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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }

  const displayName = tenantName || profile?.full_name || 'Tenant'
  const currentMonthPaid = Number(currentMonthBill?.amount_paid) || 0

  let billStatus: 'Paid' | 'Partial' | 'Due' = 'Due'
  if (totalOutstanding <= 0) {
    billStatus = 'Paid'
  } else if (currentMonthPaid > 0 && totalOutstanding > 0) {
    billStatus = 'Partial'
  } else {
    billStatus = 'Due'
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
          <h1>স্বাগতম, {displayName}!</h1>
          <p>
            {roomNumber ? `Room: ${roomNumber}` : 'আপনার Tenant Dashboard'}
            {' · '}
            আপনার বকেয়া, পেমেন্ট ও নোটিশের সারসংক্ষেপ
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
                    background: n.is_important
                      ? open
                        ? 'rgba(220, 38, 38, 0.12)'
                        : 'rgba(220, 38, 38, 0.06)'
                      : open
                      ? 'rgba(15, 60, 110, 0.06)'
                      : 'transparent',
                    padding: '12px 10px',
                    cursor: 'pointer',
                    borderLeft: n.is_important
                      ? '4px solid var(--danger)'
                      : '4px solid var(--border)',
                    borderRadius: 7,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    marginBottom: 6,
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

          <div className="sum-card blue">
            <div className="label">Bill Status</div>
            <div className="value" style={{ fontSize: '1rem' }}>
              {billStatus}
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        {(bkash || nagad || bank || payNote) && (
          <div className="card" style={{ marginBottom: 24 }}>
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
                <span>bKash Number</span>
                <strong>{bkash}</strong>
              </div>
            )}

            {nagad && (
              <div className="bill-row">
                <span>Nagad Number</span>
                <strong>{nagad}</strong>
              </div>
            )}

            {bank && (
              <div className="bill-row">
                <span>Bank Account</span>
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
                  whiteSpace: 'pre-wrap',
                }}
              >
                {payNote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
