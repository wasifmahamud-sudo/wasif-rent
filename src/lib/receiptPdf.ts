import { fmtBDT } from './calculations'

/**
 * PDF notes:
 * - package.json has no jspdf/pdf-lib; we generate a valid PDF 1.4 file in pure TS.
 * - Helvetica (WinAnsi) cannot render Bengali or ৳. Shared PDF uses "Tk" and
 *   pdfSafe() for names so the file remains readable. HTML print keeps full Unicode.
 */

/** Shape matching live payment_receipts rows (snapshot JSON). */
export type PaymentReceiptRow = {
  id: string
  payment_id: string
  tenant_id: string
  receipt_year?: number
  receipt_serial?: number
  receipt_number: string
  payment_date: string
  amount_received: number
  snapshot?: Record<string, unknown> | null
  created_at?: string
  status?: string
}

export type ReceiptDetails = {
  tenant: string
  house: string
  room: string
  phone: string
  method: string
  rent: number
  electricity: number
  previousDue: number
  other: number
  discount: number
  total: number
  paid: number
  remaining: number
  units: number
  rate: number
  reference: string
  receivedBy: string
  billingMonth: string
}

export function getReceiptDetails(receipt: PaymentReceiptRow): ReceiptDetails {
  const s = (receipt.snapshot || {}) as Record<string, unknown>
  const num = (v: unknown) => Number(v ?? 0)
  return {
    tenant: String(s.tenant_name || 'Tenant'),
    house: String(s.house_name || ''),
    room: String(s.room_number || ''),
    phone: String(s.tenant_phone || ''),
    method: String(s.payment_method || ''),
    rent: num(s.rent_amount),
    electricity: num(s.electricity_amount),
    previousDue: num(s.previous_due),
    other: num(s.other_charge),
    discount: num(s.discount),
    total: num(s.total_bill),
    paid: num(receipt.amount_received),
    remaining: num(s.remaining_due_after_payment ?? s.remaining_due),
    units: num(s.electricity_units),
    rate: num(s.electricity_rate),
    reference: String(s.transaction_reference || ''),
    receivedBy: String(s.received_by || 'Admin'),
    billingMonth: String(s.billing_month || ''),
  }
}

export function formatPaymentDate(paymentDate: string): string {
  try {
    return new Date(paymentDate + 'T00:00:00').toLocaleDateString('en-GB')
  } catch {
    return paymentDate
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Same professional layout as Admin Payment Receipts (print / Save as PDF). Unicode OK here. */
export function buildReceiptHtml(receipt: PaymentReceiptRow): string {
  const d = getReceiptDetails(receipt)
  const date = formatPaymentDate(receipt.payment_date)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(receipt.receipt_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #222; padding: 35px; max-width: 750px; margin: auto; }
    .header { background: #0f3c6e; color: #fff; padding: 18px 20px; border-radius: 8px; margin-bottom: 22px; }
    .header h1 { margin: 0 0 6px; font-size: 1.35rem; letter-spacing: 0.04em; }
    .info { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
    .section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    td:last-child { text-align: right; font-weight: 600; }
    tr.total td { font-weight: 800; background: #f0f7ff; color: #0f3c6e; }
    .footer { margin-top: 35px; border-top: 1px solid #ddd; padding-top: 15px; }
    .muted { color: #6b7280; font-size: 0.9rem; }
    @media print { body { padding: 15px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>PAYMENT RECEIPT</h1>
    <div>WASIF RENT MANAGEMENT</div>
  </div>
  <div class="info">
    <div>
      <strong>Receipt No:</strong> ${escapeHtml(receipt.receipt_number)}<br>
      <strong>Payment Date:</strong> ${escapeHtml(date)}
      ${d.billingMonth ? `<br><strong>Billing Month:</strong> ${escapeHtml(d.billingMonth)}` : ''}
    </div>
    <div>
      <strong>Tenant:</strong> ${escapeHtml(d.tenant)}<br>
      <strong>House:</strong> ${escapeHtml(d.house || '—')}<br>
      <strong>Room:</strong> ${escapeHtml(d.room || '—')}
    </div>
  </div>
  <div class="section">
    <strong>Payment Details</strong>
    <table>
      <tr><td>Room Rent</td><td>৳${fmtBDT(d.rent)}</td></tr>
      <tr><td>Electricity (${d.units} units × ৳${fmtBDT(d.rate)})</td><td>৳${fmtBDT(d.electricity)}</td></tr>
      <tr><td>Previous Due</td><td>৳${fmtBDT(d.previousDue)}</td></tr>
      <tr><td>Other Charge</td><td>৳${fmtBDT(d.other)}</td></tr>
      <tr><td>Discount</td><td>- ৳${fmtBDT(d.discount)}</td></tr>
      <tr><td>Total Bill</td><td>৳${fmtBDT(d.total)}</td></tr>
      <tr class="total"><td>Amount Received</td><td>৳${fmtBDT(d.paid)}</td></tr>
      <tr><td>Remaining Due After Payment</td><td>৳${fmtBDT(d.remaining)}</td></tr>
    </table>
  </div>
  <div class="section">
    <strong>Payment Method:</strong> ${escapeHtml(d.method || '—')}<br>
    <strong>Transaction Reference:</strong> ${escapeHtml(d.reference || 'N/A')}<br>
    <strong>Received By:</strong> ${escapeHtml(d.receivedBy)}
  </div>
  <div class="footer">
    <strong>Thank you for your payment.</strong>
    <p class="muted">This is a computer-generated payment receipt.</p>
  </div>
  <button class="no-print" onclick="window.print()">Download / Save as PDF</button>
</body>
</html>`
}

export function openReceiptPrint(receipt: PaymentReceiptRow): void {
  const html = buildReceiptHtml(receipt)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to download the receipt.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => win.print()
}

/**
 * WinAnsi-safe text for Helvetica PDF.
 * ৳ → Tk; other non-Latin characters → '?' so the PDF stays valid and readable.
 */
function pdfSafe(input: string): string {
  return Array.from(input || '')
    .map((ch) => {
      if (ch === '৳') return 'Tk'
      const code = ch.charCodeAt(0)
      if (code === 0x09 || code === 0x0a || code === 0x0d) return ' '
      if (code >= 0x20 && code <= 0x7e) return ch
      return '?'
    })
    .join('')
    .replace(/\?{3,}/g, '??')
}

function escapePdfString(s: string): string {
  return pdfSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function moneyTk(n: number): string {
  return `Tk ${fmtBDT(n)}`
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

function buildContentStream(
  receipt: PaymentReceiptRow,
  d: ReceiptDetails,
  date: string,
  rows: { label: string; value: string; bold?: boolean }[]
): string {
  const lines: string[] = []
  const add = (s: string) => lines.push(s)

  // Header bar (#0f3c6e)
  add('0.06 0.24 0.43 rg')
  add('40 780 515 45 re f')

  add('1 1 1 rg')
  add('BT /F1 16 Tf 50 805 Td (PAYMENT RECEIPT) Tj ET')
  add('BT /F1 11 Tf 50 788 Td (WASIF RENT MANAGEMENT) Tj ET')

  add('0 0 0 rg')
  let y = 755

  const left = (text: string, yy: number, size = 11) => {
    add(`BT /F1 ${size} Tf 50 ${yy} Td (${escapePdfString(text)}) Tj ET`)
  }
  const right = (text: string, yy: number, size = 11) => {
    add(`BT /F1 ${size} Tf 320 ${yy} Td (${escapePdfString(text)}) Tj ET`)
  }

  left(`Receipt No: ${receipt.receipt_number}`, y)
  right(`Tenant: ${d.tenant}`, y)
  y -= 16
  left(`Payment Date: ${date}`, y)
  right(`House: ${d.house || '-'}`, y)
  y -= 16
  if (d.billingMonth) {
    left(`Billing Month: ${d.billingMonth}`, y)
    right(`Room: ${d.room || '-'}`, y)
    y -= 16
  } else {
    right(`Room: ${d.room || '-'}`, y)
    y -= 16
  }

  y -= 8
  left('Payment Details', y, 12)
  y -= 6
  add('0.7 0.7 0.7 RG')
  add(`50 ${y} m 555 ${y} l S`)
  y -= 18
  add('0 0 0 rg')

  for (const row of rows) {
    if (y < 80) break
    left(row.label, y, row.bold ? 12 : 11)
    add(`BT /F1 ${row.bold ? 12 : 11} Tf 420 ${y} Td (${escapePdfString(row.value)}) Tj ET`)
    y -= 16
  }

  y -= 10
  add('0.7 0.7 0.7 RG')
  add(`50 ${y} m 555 ${y} l S`)
  y -= 20
  add('0 0 0 rg')

  left(`Payment Method: ${d.method || '-'}`, y)
  y -= 16
  left(`Transaction Reference: ${d.reference || 'N/A'}`, y)
  y -= 16
  left(`Received By: ${d.receivedBy}`, y)
  y -= 28
  left('Thank you for your payment.', y, 12)
  y -= 16
  left('This is a computer-generated payment receipt.', y, 10)

  return lines.join('\n')
}

/**
 * Assemble PDF with xref offsets measured in bytes (TextEncoder),
 * not JavaScript string character lengths.
 */
function assemblePdf(contentStream: string): Uint8Array {
  const enc = new TextEncoder()
  const streamBytes = enc.encode(contentStream)

  const obj = (n: number, body: string | Uint8Array): Uint8Array => {
    const head = enc.encode(`${n} 0 obj\n`)
    const bodyBytes = typeof body === 'string' ? enc.encode(body) : body
    const tail = enc.encode('\nendobj\n')
    return concatBytes([head, bodyBytes, tail])
  }

  const objects: Uint8Array[] = []

  objects.push(obj(1, '<< /Type /Catalog /Pages 2 0 R >>'))
  objects.push(obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))
  objects.push(
    obj(
      3,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
    )
  )

  const streamObj = concatBytes([
    enc.encode(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
    streamBytes,
    enc.encode('\nendstream\nendobj\n'),
  ])
  objects.push(streamObj)

  objects.push(obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'))

  const header = enc.encode('%PDF-1.4\n')
  const parts: Uint8Array[] = [header]
  const offsets: number[] = [0]
  let pos = header.length

  for (const o of objects) {
    offsets.push(pos)
    parts.push(o)
    pos += o.length
  }

  const xrefStart = pos
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  xref += `startxref\n${xrefStart}\n%%EOF\n`

  parts.push(enc.encode(xref))
  return concatBytes(parts)
}

/**
 * Build a valid single-page A4 PDF File for Web Share API.
 * Currency in file: "Tk" (Helvetica cannot draw ৳).
 */
export function buildReceiptPdfFile(receipt: PaymentReceiptRow): File {
  const d = getReceiptDetails(receipt)
  const date = formatPaymentDate(receipt.payment_date)

  const rows: { label: string; value: string; bold?: boolean }[] = [
    { label: 'Room Rent', value: moneyTk(d.rent) },
    {
      label: `Electricity (${d.units} units x Tk ${fmtBDT(d.rate)})`,
      value: moneyTk(d.electricity),
    },
    { label: 'Previous Due', value: moneyTk(d.previousDue) },
    { label: 'Other Charge', value: moneyTk(d.other) },
    { label: 'Discount', value: `- ${moneyTk(d.discount)}` },
    { label: 'Total Bill', value: moneyTk(d.total) },
    { label: 'Amount Received', value: moneyTk(d.paid), bold: true },
    { label: 'Remaining Due After Payment', value: moneyTk(d.remaining) },
  ]

  const contentStream = buildContentStream(receipt, d, date, rows)
  const pdfBytes = assemblePdf(contentStream)

  return new File([pdfBytes], `Receipt_${pdfSafe(receipt.receipt_number)}.pdf`, {
    type: 'application/pdf',
  })
}

export type ShareResult = 'shared' | 'unsupported' | 'cancelled' | 'error'

/**
 * Prefer sharing a real PDF file via Web Share API.
 * Returns 'shared' only after navigator.share resolves successfully.
 */
export async function shareReceiptPdfFile(receipt: PaymentReceiptRow): Promise<ShareResult> {
  try {
    const file = buildReceiptPdfFile(receipt)
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean
      share?: (data: ShareData) => Promise<void>
    }

    if (
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] }) &&
      typeof nav.share === 'function'
    ) {
      await nav.share({
        files: [file],
        title: `Receipt ${receipt.receipt_number}`,
        text: `Payment receipt ${receipt.receipt_number} — WASIF RENT MANAGEMENT`,
      })
      return 'shared'
    }

    return 'unsupported'
  } catch (e: unknown) {
    const name =
      e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : ''
    if (name === 'AbortError') return 'cancelled'
    console.error(e)
    return 'error'
  }
}
