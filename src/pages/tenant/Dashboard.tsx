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
      // deposit column না থাকলে error এড়াতে আগে basic select
      let tenant: any = null
      let tErr: any = null
      {
        const res = await supabase
          .from('tenants')
          .select('id, room_id, full_name, deposit')
          .eq('user_id', uid)
          .eq('active', true)
          .maybeSingle()
        tenant = res.data
        tErr = res.error
        if (tErr && String(tErr.message || '').toLowerCase().includes('deposit')) {
          const res2 = await supabase
            .from('tenants')
            .select('id, room_id, full_name')
            .eq('user_id', uid)
            .eq('active', true)
            .maybeSingle()
          tenant = res2.data
          tErr = res2.error
        }
      }

      if (tErr || !tenant) {
        setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
        setLoading(false)
        return
      }

      if (tenant.deposit != null) setDeposit(Number(tenant.deposit))

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
            {Number(bill.other_charge) > 0 && (
              <div className="bill-row"><span>Other Charge</span><span>৳{fmtBDT(bill.other_charge)}</span></div>
            )}
            {Number(bill.discount) > 0 && (
              <div className="bill-row"><span>Discount</span><span>-৳{fmtBDT(bill.discount)}</span></div>
            )}
            <div className="bill-row total"><span>TOTAL</span><span>৳{fmtBDT(bill.total_bill)}</span></div>
            <div className="bill-row paid-row"><span>Paid</span><span>৳{fmtBDT(bill.amount_paid)}</span></div>
            <div className="bill-row due-row"><span>REMAINING DUE</span><span>৳{fmtBDT(bill.remaining_due)}</span></div>
          </div>
        ) : (
          !error && <div className="empty" style={{ marginBottom: 16 }}>এখনো কোনো বিল তৈরি হয়নি</div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>⚡ My Electricity Usage</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 12 }}>
            Read-only · Admin enters meter readings
          </div>

          {meters.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>Reading unavailable</div>
          ) : (
            meters.map((m, idx) => {
              const units = unitsFor(m)
              const delta = usageDelta(idx)
              const hasReading =
                m.previous_reading != null || m.current_reading != null || units != null
              const linked = billHistory.find((b) => b.billing_month === m.billing_month)
              return (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{formatMonth(m.billing_month)}</div>
                  {!hasReading ? (
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Reading unavailable</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.82rem' }}>
                      <div>
                        Previous:{' '}
                        <strong>{m.previous_reading != null ? m.previous_reading : 'Reading unavailable'}</strong>
                      </div>
                      <div>
                        Current:{' '}
                        <strong>{m.current_reading != null ? m.current_reading : 'Reading unavailable'}</strong>
                      </div>
                      <div>
                        Units: <strong>{units != null ? units : 'Reading unavailable'}</strong>
                      </div>
                      {linked && (
                        <div>
                          Rate: <strong>৳{fmtBDT(linked.electricity_rate)}/u</strong>
                        </div>
                      )}
                      {linked && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          Charge:{' '}
                          <strong style={{ color: 'var(--primary)' }}>৳{fmtBDT(linked.electricity_amount)}</strong>
                        </div>
                      )}
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          fontSize: '0.75rem',
                          color: delta.up === true ? 'var(--danger)' : delta.up === false ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: 600,
                        }}
                      >
                        {delta.text}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {meters.length === 0 && billHistory.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 8 }}>
                From bills (meter reading not stored)
              </div>
              {billHistory.slice(0, 4).map((b, idx, arr) => {
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
                      Units: <strong>{b.electricity_units}</strong> · Rate: ৳{fmtBDT(b.electricity_rate)} · Charge:{' '}
                      <strong>৳{fmtBDT(b.electricity_amount)}</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>{cmp}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      Previous / current meter: Reading unavailable
                    </div>
                  </div>
                )
              })}
            </div>
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

        <div className="card" style={{ marginBottom: 24 }}>
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
      </div>
    </div>
  )
}
