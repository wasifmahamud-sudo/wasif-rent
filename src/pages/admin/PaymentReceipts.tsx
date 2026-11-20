
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'

interface Receipt {
  id: string
  payment_id: string
  tenant_id: string
  receipt_year: number
  receipt_serial: number
  receipt_number: string
  payment_date: string
  amount_received: number
  snapshot: any
  created_at: string
}

export default function PaymentReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const loadReceipts = async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setError(error.message)
    } else {
      setReceipts((data || []) as Receipt[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadReceipts()
  }, [])

  const getDetails = (receipt: Receipt) => {
    const s = receipt.snapshot || {}

    return {
      tenant: s.tenant_name || 'Tenant',
      house: s.house_name || '',
      room: s.room_number || '',
      phone: s.tenant_phone || '',
      method: s.payment_method || '',
      rent: Number(s.rent_amount || 0),
      electricity: Number(s.electricity_amount || 0),
      previousDue: Number(s.previous_due || 0),
      other: Number(s.other_charge || 0),
      discount: Number(s.discount || 0),
      total: Number(s.total_bill || 0),
      paid: Number(receipt.amount_received || 0),
      remaining: Number(s.remaining_due_after_payment || 0),
      units: Number(s.electricity_units || 0),
      rate: Number(s.electricity_rate || 0),
      reference: s.transaction_reference || '',
      receivedBy: s.received_by || 'Admin',
    }
  }

  const downloadPDF = (receipt: Receipt) => {
    const d = getDetails(receipt)
    const date = new Date(
      receipt.payment_date + 'T00:00:00'
    ).toLocaleDateString('en-GB')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${receipt.receipt_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #222;
            padding: 35px;
            max-width: 750px;
            margin: auto;
          }
          .header {
            background: #173b70;
            color: white;
            padding: 22px;
            border-radius: 8px;
          }
          h1 { margin: 0 0 6px; font-size: 25px; }
          .muted { color: #666; font-size: 13px; }
          .info {
            display: flex;
            justify-content: space-between;
            margin: 25px 0;
            gap: 20px;
          }
          .section { margin: 20px 0; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          td {
            padding: 11px;
            border-bottom: 1px solid #ddd;
          }
          td:last-child {
            text-align: right;
            font-weight: 600;
          }
          .total {
            font-size: 20px;
            color: #173b70;
            font-weight: bold;
          }
          .footer {
            margin-top: 35px;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          @media print {
            body { padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PAYMENT RECEIPT</h1>
          <div>WASIF RENT MANAGEMENT</div>
        </div>

        <div class="info">
          <div>
            <strong>Receipt No:</strong> ${receipt.receipt_number}<br>
            <strong>Payment Date:</strong> ${date}
          </div>
          <div>
            <strong>Tenant:</strong> ${d.tenant}<br>
            <strong>House:</strong> ${d.house}<br>
            <strong>Room:</strong> ${d.room}
          </div>
        </div>

        <div class="section">
          <strong>Payment Details</strong>
          <table>
            <tr><td>Room Rent</td><td>৳${fmtBDT(d.rent)}</td></tr>
            <tr><td>Electricity (${d.units} units × ৳${d.rate})</td><td>৳${fmtBDT(d.electricity)}</td></tr>
            <tr><td>Previous Due</td><td>৳${fmtBDT(d.previousDue)}</td></tr>
            <tr><td>Other Charge</td><td>৳${fmtBDT(d.other)}</td></tr>
            <tr><td>Discount</td><td>- ৳${fmtBDT(d.discount)}</td></tr>
            <tr><td>Total Bill</td><td>৳${fmtBDT(d.total)}</td></tr>
            <tr class="total"><td>Amount Received</td><td>৳${fmtBDT(d.paid)}</td></tr>
            <tr><td>Remaining Due After Payment</td><td>৳${fmtBDT(d.remaining)}</td></tr>
          </table>
        </div>

        <div class="section">
          <strong>Payment Method:</strong> ${d.method}<br>
          <strong>Transaction Reference:</strong> ${d.reference || 'N/A'}<br>
          <strong>Received By:</strong> ${d.receivedBy}
        </div>

        <div class="footer">
          <strong>Thank you for your payment.</strong>
          <p class="muted">This is a computer-generated payment receipt.</p>
        </div>

        <button class="no-print" onclick="window.print()">
          Download / Save as PDF
        </button>
      </body>
      </html>
    `

    const win = window.open('', '_blank')

    if (!win) {
      alert('Please allow pop-ups to download the receipt.')
      return
    }

    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  const shareWhatsApp = (receipt: Receipt) => {
    const d = getDetails(receipt)

    const message = [
      'PAYMENT RECEIPT',
      'WASIF RENT MANAGEMENT',
      '',
      `Receipt No: ${receipt.receipt_number}`,
      `Date: ${receipt.payment_date}`,
      `Tenant: ${d.tenant}`,
      `House: ${d.house}`,
      `Room: ${d.room}`,
      `Amount Received: Tk ${fmtBDT(d.paid)}`,
      `Remaining Due: Tk ${fmtBDT(d.remaining)}`,
      '',
      'Thank you for your payment.',
    ].join('\n')

    const phone = d.phone.replace(/\D/g, '')

    if (!phone) {
      alert('Tenant phone number is not available.')
      return
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank'
    )
  }

  const filtered = receipts.filter((r) => {
    const d = getDetails(r)
    const q = search.toLowerCase()

    return (
      r.receipt_number.toLowerCase().includes(q) ||
      d.tenant.toLowerCase().includes(q) ||
      d.house.toLowerCase().includes(q) ||
      d.room.toLowerCase().includes(q)
    )
  })

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
            <h1>Payment Receipts</h1>
            <div className="sub">Payment receipt history</div>
          </div>

          <Link
            to="/admin"
            className="btn btn-outline"
            style={{ padding: '8px 12px' }}
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="page-content">
        <div className="grid-4" style={{ marginBottom: 12 }}>
          <div className="sum-card blue">
            <div className="label">Total Receipts</div>
            <div className="value">{receipts.length}</div>
          </div>

          <div className="sum-card green">
            <div className="label">Total Received</div>
            <div className="value">
              ৳{fmtBDT(
                receipts.reduce(
                  (s, r) => s + Number(r.amount_received),
                  0
                )
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search receipt, tenant, house or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 12,
              border: '1.5px solid var(--border)',
              background: 'white',
            }}
          />

          <button className="btn btn-outline" onClick={loadReceipts}>
            ↻
          </button>
        </div>

        {loading ? (
          <div className="empty">Loading receipts...</div>
        ) : error ? (
          <div className="card" style={{ padding: 16, color: '#c0392b' }}>
            Could not load receipts: {error}
            <button
              className="btn btn-primary"
              onClick={loadReceipts}
              style={{ marginTop: 10 }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">No payment receipts found.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map((receipt) => {
              const d = getDetails(receipt)

              return (
                <div
                  key={receipt.id}
                  style={{
                    padding: 14,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--primary)' }}>
                        {receipt.receipt_number}
                      </strong>

                      <div style={{ fontWeight: 700, marginTop: 5 }}>
                        {d.tenant}
                      </div>

                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                        {d.house} · Room {d.room} · {receipt.payment_date}
                      </div>
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        color: '#15945c',
                      }}
                    >
                      ৳{fmtBDT(receipt.amount_received)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      className="btn btn-primary"
                      onClick={() => downloadPDF(receipt)}
                    >
                      ↓ Download PDF
                    </button>

                    <button
                      className="btn btn-success"
                      onClick={() => shareWhatsApp(receipt)}
                    >
                      WhatsApp Share
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
