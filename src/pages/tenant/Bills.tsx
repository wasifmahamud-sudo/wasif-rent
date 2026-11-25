
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'
import type { Bill } from '../../types/database'

function calculateTotalOutstanding(bills: Bill[]): number {
  if (!bills || bills.length === 0) return 0

  const sorted = [...bills].sort((a, b) =>
    String(a.billing_month).localeCompare(String(b.billing_month))
  )

  let total = 0

  for (let i = 0; i < sorted.length; i++) {
    const currentDue = Math.max(
      0,
      Number(sorted[i].remaining_due) || 0
    )

    if (i < sorted.length - 1) {
      const nextPrevDue = Math.max(
        0,
        Number(sorted[i + 1].previous_due) || 0
      )

      const carried = Math.min(currentDue, nextPrevDue)
      const orphan = Math.round((currentDue - carried) * 100) / 100

      if (orphan > 0.009) {
        total += orphan
      }
    } else {
      total += currentDue
    }
  }

  return Math.round(total * 100) / 100
}

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

      const allBills: Bill[] = []
      const batchSize = 100
      let from = 0

      while (true) {
        const { data, error: billError } = await supabase
          .from('bills')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('billing_month', { ascending: false })
          .range(from, from + batchSize - 1)

        if (billError) throw billError

        const rows = (data || []) as Bill[]
        allBills.push(...rows)

        if (rows.length < batchSize) break
        from += batchSize
      }

      setBills(allBills)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'বিল লোড করা যায়নি। আবার চেষ্টা করুন।'
      )
      setBills([])
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const thisMonth =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const currentMonthBill =
    bills.find((bill) =>
      String(bill.billing_month).startsWith(thisMonth.slice(0, 7))
    ) || null

  const currentTotalBill = currentMonthBill
    ? Number(currentMonthBill.total_bill || 0)
    : 0

  const previousDue = currentMonthBill
    ? Math.max(0, Number(currentMonthBill.previous_due || 0))
    : 0

  // Current month's own charges, excluding previous month's due.
  const currentMonthCharges = Math.max(
    0,
    currentTotalBill - previousDue
  )

  // This remaining amount includes any previous due carried forward.
  const currentMonthRemainingDue = currentMonthBill
    ? Math.max(0, Number(currentMonthBill.remaining_due || 0))
    : 0

  const totalOutstanding = calculateTotalOutstanding(bills)

  const totalPaid = bills.reduce(
    (sum, bill) => sum + Number(bill.amount_paid || 0),
    0
  )

  function statusLabel(status: Bill['status']) {
    const labels: Record<string, string> = {
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
        <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
          আপনার বিল লোড হচ্ছে...
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

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadBills}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '18px' }}>
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadBills}
            style={{ marginTop: '10px' }}
          >
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <h3>Current Month Bill</h3>
              <span>
                {currentMonthBill
                  ? formatMonth(currentMonthBill.billing_month)
                  : 'No bill'}
              </span>
            </div>

            {currentMonthBill ? (
              <div className="bill-detail-content">
                <div className="bill-row">
                  <span>Monthly Rent</span>
                  <strong>
                    ৳{fmtBDT(Number(currentMonthBill.rent_amount || 0))}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Electricity</span>
                  <strong>
                    {Number(currentMonthBill.electricity_units || 0)} Units
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Electricity Bill</span>
                  <strong>
                    ৳{fmtBDT(Number(currentMonthBill.electricity_amount || 0))}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Other Charge</span>
                  <strong>
                    ৳{fmtBDT(Number(currentMonthBill.other_charge || 0))}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Discount</span>
                  <strong>
                    ৳{fmtBDT(Number(currentMonthBill.discount || 0))}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Previous Due</span>
                  <strong>
                    ৳{fmtBDT(previousDue)}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Current Month Charges (Previous Due বাদে)</span>
                  <strong>
                    ৳{fmtBDT(currentMonthCharges)}
                  </strong>
                </div>

                <div className="bill-row">
                  <strong>Total Bill (Previous Due সহ)</strong>
                  <strong>
                    ৳{fmtBDT(currentTotalBill)}
                  </strong>
                </div>

                <div className="bill-row">
                  <span>Paid This Month</span>
                  <strong>
                    ৳{fmtBDT(Number(currentMonthBill.amount_paid || 0))}
                  </strong>
                </div>

                <div className="bill-row">
                  <strong>Current Month Remaining Due</strong>
                  <strong style={{ color: 'var(--danger)' }}>
                    ৳{fmtBDT(currentMonthRemainingDue)}
                  </strong>
                </div>

                {currentMonthBill.notes && (
                  <p>Note: {currentMonthBill.notes}</p>
                )}
              </div>
            ) : (
              <div className="empty-state">
                এই মাসের কোনো বিল তৈরি করা হয়নি।
              </div>
            )}
          </div>

          <div className="stats-grid">
            <div className="card">
              <div className="stat-label">Current Month Charges</div>
              <div className="stat-value">
                ৳{fmtBDT(currentMonthCharges)}
              </div>
            </div>

            <div className="card">
              <div className="stat-label">Previous Due</div>
              <div className="stat-value">
                ৳{fmtBDT(previousDue)}
              </div>
            </div>

            <div className="card">
              <div className="stat-label">Total Paid (All Months)</div>
              <div className="stat-value">
                ৳{fmtBDT(totalPaid)}
              </div>
            </div>

            <div className="card">
              <div className="stat-label">Total Outstanding</div>
              <div className="stat-value">
                ৳{fmtBDT(totalOutstanding)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Billing History</h3>
              <span>{bills.length} bills</span>
            </div>

            {bills.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '38px', marginBottom: '10px' }}>
                  🧾
                </div>
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

                        <td>
                          {fmtBDT(Number(bill.total_bill || 0))}
                        </td>

                        <td>
                          {fmtBDT(Number(bill.amount_paid || 0))}
                        </td>

                        <td>
                          {fmtBDT(
                            Math.max(0, Number(bill.remaining_due || 0))
                          )}
                        </td>

                        <td>
                          <span className={`status-badge ${bill.status}`}>
                            {statusLabel(bill.status)}
                          </span>
                        </td>

                        <td>
                          <details>
                            <summary>View Details</summary>

                            <div className="bill-detail-content">
                              <p>
                                Rent: {fmtBDT(Number(bill.rent_amount || 0))}
                              </p>

                              <p>
                                Electricity: {bill.electricity_units || 0} units
                              </p>

                              <p>
                                Electricity Rate:{' '}
                                {fmtBDT(Number(bill.electricity_rate || 0))}/unit
                              </p>

                              <p>
                                Electricity Bill:{' '}
                                {fmtBDT(Number(bill.electricity_amount || 0))}
                              </p>

                              <p>
                                Previous Due:{' '}
                                {fmtBDT(Number(bill.previous_due || 0))}
                              </p>

                              <p>
                                Other Charge:{' '}
                                {fmtBDT(Number(bill.other_charge || 0))}
                              </p>

                              <p>
                                Discount:{' '}
                                {fmtBDT(Number(bill.discount || 0))}
                              </p>

                              <p>
                                <strong>
                                  Total Bill:{' '}
                                  {fmtBDT(Number(bill.total_bill || 0))}
                                </strong>
                              </p>

                              <p>
                                Paid: {fmtBDT(Number(bill.amount_paid || 0))}
                              </p>

                              <p>
                                Remaining Due:{' '}
                                {fmtBDT(Number(bill.remaining_due || 0))}
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
        </>
      )}
    </div>
  )
}
