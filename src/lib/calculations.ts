/**
 * Core bill calculation – matches original app logic exactly.
 * electricity_units = current - previous (never negative unless admin overrides)
 * electricity_amount = units * rate
 * total_bill = rent + electricity_amount + previous_due + other_charge - discount
 * remaining_due = total_bill - amount_paid
 */

export interface BillCalcInput {
  rent_amount: number
  electricity_units: number
  electricity_rate: number
  previous_due: number
  other_charge?: number
  discount?: number
  amount_paid?: number
}

export interface BillCalcResult {
  electricity_amount: number
  total_bill: number
  remaining_due: number
  status: 'unpaid' | 'partial' | 'paid' | 'overpaid'
}

export function calculateBill(input: BillCalcInput): BillCalcResult {
  const units = Math.max(0, Number(input.electricity_units) || 0)
  const rate = Number(input.electricity_rate) || 0
  const rent = Number(input.rent_amount) || 0
  const prevDue = Number(input.previous_due) || 0
  const other = Number(input.other_charge) || 0
  const discount = Number(input.discount) || 0
  const paid = Number(input.amount_paid) || 0

  const electricity_amount = Math.round(units * rate * 100) / 100
  const total_bill =
    Math.round((rent + electricity_amount + prevDue + other - discount) * 100) / 100
  const remaining_due = Math.round((total_bill - paid) * 100) / 100

  let status: BillCalcResult['status'] = 'unpaid'
  if (remaining_due <= 0 && paid > 0) {
    status = paid > total_bill ? 'overpaid' : 'paid'
  } else if (paid > 0) {
    status = 'partial'
  }

  return { electricity_amount, total_bill, remaining_due, status }
}

/** Format Bangladeshi Taka */
export function fmtBDT(n: number | string | null | undefined): string {
  if (n === '' || n === null || n === undefined || isNaN(Number(n))) return '0'
  return Number(n).toLocaleString('en-BD')
}

/** Format month label e.g. 2026-08-01 → Aug 2026 */
export function formatMonth(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[d.getMonth()]} ${d.getFullYear()}`
}

/** Get first day of month as YYYY-MM-DD */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}
