
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'
import type { Bill } from '../../types/database'

export default function TenantBills() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadBills()
  }, [])

  async function loadBills() {
    setLoading(true)
    setError('')

    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

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

      const { data, error: billError } = await supabase
        .from('bills')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('billing_month', { ascending: false })

      if (billError) throw billError

      setBills((data || []) as Bill[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'বিল লোড করা যায়নি। আবার চেষ্টা করুন।'
      )
    } finally {
      setLoading(false)
    }
  }

  const totalDue = bills.reduce(
    (sum, bill) => sum + Number(bill.remaining_due || 0),
    0
  )

  const totalPaid = bills.reduce(
    (sum, bill) => sum + Number(bill.amount_paid || 0),
    0
  )

  function statusLabel(status: Bill['status']) {
    const labels = {
      paid: 'Paid',
      partial: 'Partially Paid',
      unpaid: 'Unpaid',
      overpaid: 'Overpaid',
    }

    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">
          <p>আপনার বিল লোড হচ্ছে...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>My Bills</h2>
          <p>আপনার সকল মাসের বিল ও পেমেন্টের হিসাব</p>
        </div>
        <button className="btn btn-secondary" onClick={loadBills}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">Total Bills</div>
          <div className="stat-value">{bills.length}</div>
        </div>

        <div className="card">
          <div className="stat-label">Total Paid</div>
          <div className="stat-value">{fmtBDT(totalPaid)}</div>
        </div>

        <div className="card">
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value">{fmtBDT(totalDue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Billing History</h3>
          <span>{bills.length} bills</span>
        </div>

        {bills.length === 0 ? (
          <div className="empty-state">
            <h3>No Bills Found</h3>
            <p>আপনার নামে এখনো কোনো বিল তৈরি করা হয়নি।</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Total Bill</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{formatMonth(bill.billing_month)}</td>
                    <td>{fmtBDT(Number(bill.total_bill))}</td>
                    <td>{fmtBDT(Number(bill.amount_paid))}</td>
                    <td>{fmtBDT(Number(bill.remaining_due))}</td>
                    <td>
                      <span className={`status-badge ${bill.status}`}>
                        {statusLabel(bill.status)}
                      </span>
                    </td>
                    <td>
                      <details>
                        <summary>View Details</summary>
                        <div className="bill-detail-content">
                          <p>Rent: {fmtBDT(Number(bill.rent_amount))}</p>
                          <p>
                            Electricity: {bill.electricity_units} units
                          </p>
                          <p>
                            Electricity Rate: {fmtBDT(Number(bill.electricity_rate))}/unit
                          </p>
                          <p>
                            Electricity Bill: {fmtBDT(Number(bill.electricity_amount))}
                          </p>
                          <p>
                            Previous Due: {fmtBDT(Number(bill.previous_due))}
                          </p>
                          <p>
                            Other Charge: {fmtBDT(Number(bill.other_charge))}
                          </p>
                          <p>
                            Discount: {fmtBDT(Number(bill.discount))}
                          </p>
                          <p>
                            <strong>Total Bill: {fmtBDT(Number(bill.total_bill))}</strong>
                          </p>
                          {bill.notes && <p>Note: {bill.notes}</p>}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
