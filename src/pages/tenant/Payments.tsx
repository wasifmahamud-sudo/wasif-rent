
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'
import type { Payment } from '../../types/database'

export default function TenantPayments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPayments()
  }, [])

  async function loadPayments() {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('আপনার লগইন তথ্য পাওয়া যায়নি।')
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (tenantError) throw tenantError

      if (!tenant) {
        throw new Error('আপনার Tenant account পাওয়া যায়নি।')
      }

      const { data, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('payment_date', { ascending: false })

      if (paymentError) throw paymentError

      setPayments((data || []) as Payment[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'পেমেন্ট হিস্টোরি লোড করা যায়নি।'
      )
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  )

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
          পেমেন্ট হিস্টোরি লোড হচ্ছে...
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Payment History</h2>
          <p>আপনার সকল পেমেন্টের বিস্তারিত হিসাব</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadPayments}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '18px' }}>
          {error}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadPayments}
            style={{ marginTop: '10px' }}
          >
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="stats-grid">
            <div className="card">
              <div className="stat-label">Total Transactions</div>
              <div className="stat-value">{payments.length}</div>
            </div>

            <div className="card">
              <div className="stat-label">Total Amount Paid</div>
              <div className="stat-value">{fmtBDT(totalPaid)}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>All Transactions</h3>
              <span>{payments.length} payments</span>
            </div>

            {payments.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '38px', marginBottom: '10px' }}>
                  💳
                </div>
                <h3>No Payments Found</h3>
                <p>আপনার কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Transaction Reference</th>
                        <th>Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.payment_date)}</td>
                          <td>
                            <strong>{fmtBDT(Number(payment.amount || 0))}</strong>
                          </td>
                          <td>{payment.payment_method || '—'}</td>
                          <td>{payment.transaction_reference || '—'}</td>
                          <td>{payment.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className="tenant-payment-mobile-list"
                  style={{ padding: '0 14px 14px' }}
                >
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="card"
                      style={{
                        padding: '16px',
                        marginBottom: '12px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            Payment Date
                          </div>
                          <strong>{formatDate(payment.payment_date)}</strong>
                        </div>

                        <strong style={{ color: 'var(--accent)', fontSize: '18px' }}>
                          {fmtBDT(Number(payment.amount || 0))}
                        </strong>
                      </div>

                      <div style={{ marginTop: '14px', fontSize: '13px' }}>
                        <p>Method: {payment.payment_method || '—'}</p>
                        <p style={{ marginTop: '6px' }}>
                          Reference: {payment.transaction_reference || '—'}
                        </p>
                        <p style={{ marginTop: '6px' }}>
                          Note: {payment.note || '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
