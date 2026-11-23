
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'
import {
  getReceiptDetails,
  formatPaymentDate,
  openReceiptPrint,
  shareReceiptPdfFile,
  type PaymentReceiptRow,
} from '../../lib/receiptPdf'

export default function TenantPaymentReceipts() {
  const [receipts, setReceipts] = useState<PaymentReceiptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareHint, setShareHint] = useState('')

  useEffect(() => {
    loadReceipts()
  }, [])

  async function loadReceipts() {
    setLoading(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('payment_receipts')
      .select('*')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setReceipts([])
    } else {
      setReceipts((data || []) as PaymentReceiptRow[])
    }

    setLoading(false)
  }

  function handleDownload(receipt: PaymentReceiptRow) {
    openReceiptPrint(receipt)
  }

  async function handleWhatsAppShare(receipt: PaymentReceiptRow) {
    setShareHint('')

    const result = await shareReceiptPdfFile(receipt)

    if (result === 'unsupported') {
      setShareHint(
        'Your browser does not support PDF file sharing. Please download the PDF and share it manually.'
      )
    } else if (result === 'error') {
      setShareHint(
        'Could not share the PDF. Please download the receipt and try again.'
      )
    }
  }

  return (
    <div className="tenant-receipts-page">
      <div className="tenant-page-heading">
        <div>
          <h1>Payment Receipts</h1>
          <p>View and download your payment receipts</p>
        </div>

        <Link to="/tenant" className="btn">
          Back to Dashboard
        </Link>
      </div>

      {shareHint && (
        <div
          style={{
            padding: '14px',
            marginBottom: '18px',
            borderRadius: '10px',
            border: '1px solid var(--warning)',
            background: 'var(--yellow)',
            color: 'inherit',
            fontSize: '14px',
          }}
        >
          {shareHint}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
          Loading payment receipts...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '24px' }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button
            type="button"
            onClick={loadReceipts}
            className="btn"
            style={{ marginTop: '16px' }}
          >
            Try Again
          </button>
        </div>
      ) : receipts.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🧾</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
            No Payment Receipts Yet
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>
            Your payment receipts will appear here after payments are recorded.
          </p>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{
              padding: '20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ color: 'var(--muted)', fontSize: '14px' }}>
                Total Receipts
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '5px' }}>
                {receipts.length}
              </div>
            </div>
            <div style={{ fontSize: '32px' }}>🧾</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: '16px',
            }}
          >
            {receipts.map((receipt) => {
              const details = getReceiptDetails(receipt)

              return (
                <div
                  key={receipt.id}
                  className="card"
                  style={{ padding: '20px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingBottom: '16px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          marginBottom: '5px',
                        }}
                      >
                        Receipt Number
                      </div>
                      <h3 style={{ fontWeight: 700, fontSize: '16px' }}>
                        {receipt.receipt_number}
                      </h3>
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--muted)',
                          marginTop: '5px',
                        }}
                      >
                        {formatPaymentDate(receipt.payment_date)}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Amount Received
                      </div>
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 800,
                          color: 'var(--accent)',
                          marginTop: '5px',
                        }}
                      >
                        ৳{fmtBDT(receipt.amount_received)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                      gap: '16px',
                      padding: '18px 0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        House
                      </div>
                      <div style={{ fontWeight: 600, marginTop: '5px' }}>
                        {details.house || '—'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Room
                      </div>
                      <div style={{ fontWeight: 600, marginTop: '5px' }}>
                        {details.room || '—'}
                      </div>
                    </div>

                    {details.billingMonth && (
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          Billing Month
                        </div>
                        <div style={{ fontWeight: 600, marginTop: '5px' }}>
                          {details.billingMonth}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDownload(receipt)}
                      className="btn"
                    >
                      <span style={{ marginRight: '6px' }}>↓</span>
                      Download PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(receipt)}
                      className="btn"
                    >
                      <span style={{ marginRight: '6px' }}>↗</span>
                      Share PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
