import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'
import type { Bill, Payment } from '../../types/database'

export default function TenantDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [bill, setBill] = useState<Bill | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // Get my tenant record
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .select('id, room_id, full_name')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('active', true)
        .maybeSingle()

      if (tErr || !tenant) {
        setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
        setLoading(false)
        return
      }

      if (tenant.room_id) {
        const { data: room } = await supabase
          .from('rooms')
          .select('room_number')
          .eq('id', tenant.room_id)
          .single()
        if (room) setRoomNumber(room.room_number)
      }

      // Latest bill (current month preferred)
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      let { data: bills } = await supabase
        .from('bills')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('billing_month', { ascending: false })
        .limit(1)

      // Prefer this month if exists
      const { data: thisMonthBill } = await supabase
        .from('bills')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('billing_month', thisMonth)
        .maybeSingle()

      const currentBill = thisMonthBill || (bills && bills[0]) || null
      setBill(currentBill)

      if (currentBill) {
        const { data: pays } = await supabase
          .from('payments')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('payment_date', { ascending: false })
          .limit(20)
        setPayments(pays || [])
      }
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

  const handlePrint = () => window.print()

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Welcome, {profile?.full_name || 'Tenant'}</h1>
            <div className="sub">{roomNumber ? `Room: ${roomNumber}` : 'Tenant Portal'}</div>
          </div>
          <button className="btn btn-outline" onClick={handleLogout} style={{ padding: '8px 12px' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {!bill && !error && (
          <div className="empty">এখনো কোনো বিল তৈরি হয়নি</div>
        )}

        {bill && (
          <>
            <div className="bill-card">
              <div className="bill-header">
                Current Bill — {formatMonth(bill.billing_month)}
              </div>
              <div className="bill-row">
                <span>Room</span>
                <span style={{ fontWeight: 700 }}>{roomNumber || '—'}</span>
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
                <span>Electricity Rate</span>
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
              {Number(bill.other_charge) > 0 && (
                <div className="bill-row">
                  <span>Other Charge</span>
                  <span>৳{fmtBDT(bill.other_charge)}</span>
                </div>
              )}
              {Number(bill.discount) > 0 && (
                <div className="bill-row">
                  <span>Discount</span>
                  <span>-৳{fmtBDT(bill.discount)}</span>
                </div>
              )}
              <div className="bill-row total">
                <span>TOTAL PAYABLE</span>
                <span>৳{fmtBDT(bill.total_bill)}</span>
              </div>
              <div className="bill-row paid-row">
                <span>Paid</span>
                <span>৳{fmtBDT(bill.amount_paid)}</span>
              </div>
              <div className="bill-row due-row">
                <span>REMAINING DUE</span>
                <span>৳{fmtBDT(bill.remaining_due)}</span>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 20 }} onClick={handlePrint}>
              🖨️ Print / Download Statement
            </button>

            <h3 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 10 }}>Payment History</h3>
            {payments.length === 0 ? (
              <div className="empty" style={{ padding: 20 }}>কোনো পেমেন্ট নেই</div>
            ) : (
              payments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'white',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 8,
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.payment_method}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {p.payment_date}
                      {p.note ? ` · ${p.note}` : ''}
                      {p.transaction_reference ? ` · ${p.transaction_reference}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--accent)' }}>+৳{fmtBDT(p.amount)}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
