
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payment Receipts</h1>
          <p className="text-sm text-gray-500 mt-1">
            View and download your payment receipts
          </p>
        </div>

        <Link
          to="/tenant"
          className="btn"
        >
          Back to Dashboard
        </Link>
      </div>

      {shareHint && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {shareHint}
        </div>
      )}

      {loading ? (
        <div className="card p-6 text-center">
          Loading payment receipts...
        </div>
      ) : error ? (
        <div className="card p-6">
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={loadReceipts}
            className="btn mt-4"
          >
            Try Again
          </button>
        </div>
      ) : receipts.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🧾</div>
          <h2 className="text-lg font-semibold">No Payment Receipts Yet</h2>
          <p className="text-sm text-gray-500 mt-2">
            Your payment receipts will appear here after payments are recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-4">
            <div className="text-sm text-gray-500">Total Receipts</div>
            <div className="text-2xl font-bold mt-1">
              {receipts.length}
            </div>
          </div>

          <div className="space-y-4">
            {receipts.map((receipt) => {
              const details = getReceiptDetails(receipt)

              return (
                <div
                  key={receipt.id}
                  className="card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base">
                        {receipt.receipt_number}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatPaymentDate(receipt.payment_date)}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        Amount Received
                      </div>
                      <div className="text-lg font-bold">
                        ৳{fmtBDT(receipt.amount_received)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <div className="text-gray-500">House</div>
                      <div className="font-medium">
                        {details.house || '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500">Room</div>
                      <div className="font-medium">
                        {details.room || '—'}
                      </div>
                    </div>

                    {details.billingMonth && (
                      <div className="col-span-2">
                        <div className="text-gray-500">Billing Month</div>
                        <div className="font-medium">
                          {details.billingMonth}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-5">
                    <button
                      type="button"
                      onClick={() => handleDownload(receipt)}
                      className="btn"
                    >
                      Download PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(receipt)}
                      className="btn"
                    >
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
