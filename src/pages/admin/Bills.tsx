import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { fmtBDT, formatMonth, calculateBill } from '../../lib/calculations'

interface House { id: string; name: string }
interface Room { id: string; house_id: string; room_number: string; monthly_rent: number }
interface Tenant {
  id: string
  full_name: string
  phone: string | null
  room_id: string | null
  active: boolean
  room?: Room
}
interface BillRow {
  id?: string
  tenant_id: string
  room_id: string
  billing_month: string
  rent_amount: number
  electricity_units: number
  electricity_rate: number
  electricity_amount: number
  previous_due: number
  other_charge: number
  discount: number
  total_bill: number
  amount_paid: number
  remaining_due: number
  status: string
  // UI helpers
  prev_reading: number
  curr_reading: number
  tenant_name: string
  room_number: string
  phone: string
}

export default function AdminBills() {
  const { profile } = useAuth()
  const [houses, setHouses] = useState<House[]>([])
  const [currentHouseId, setCurrentHouseId] = useState<string>('')
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [rows, setRows] = useState<BillRow[]>([])
  const [rate, setRate] = useState(12)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  // Pay modal
  const [payOpen, setPayOpen] = useState(false)
  const [payRow, setPayRow] = useState<BillRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [payNote, setPayNote] = useState('')
  const [payRef, setPayRef] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const loadHousesAndRate = useCallback(async () => {
    const [hRes, rRes] = await Promise.all([
      supabase.from('houses').select('id, name').order('name'),
      supabase.from('electricity_rates').select('rate_per_unit').eq('active', true).limit(1).maybeSingle(),
    ])
    if (hRes.data) {
      setHouses(hRes.data)
      if (hRes.data.length && !currentHouseId) setCurrentHouseId(hRes.data[0].id)
    }
    if (rRes.data?.rate_per_unit) setRate(Number(rRes.data.rate_per_unit))
  }, [currentHouseId])

  const loadBills = useCallback(async () => {
    if (!currentHouseId) return
    setLoading(true)
    try {
      // Tenants + rooms for this house
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, house_id, room_number, monthly_rent')
        .eq('house_id', currentHouseId)

      const roomIds = (rooms || []).map((r) => r.id)
      if (roomIds.length === 0) {
        setRows([])
        setLoading(false)
        return
      }

      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, full_name, phone, room_id, active')
        .in('room_id', roomIds)
        .eq('active', true)

      // Existing bills for month
      const tenantIds = (tenants || []).map((t) => t.id)
      let billsMap: Record<string, any> = {}
      if (tenantIds.length) {
        const { data: bills } = await supabase
          .from('bills')
          .select('*')
          .eq('billing_month', month)
          .in('tenant_id', tenantIds)
        ;(bills || []).forEach((b) => { billsMap[b.tenant_id] = b })
      }

      // Meter readings for month
      let meterMap: Record<string, any> = {}
      const { data: meters } = await supabase
        .from('meter_readings')
        .select('*')
        .eq('billing_month', month)
        .in('room_id', roomIds)
      ;(meters || []).forEach((m) => { meterMap[m.room_id] = m })

      // Previous month for prev reading fallback
      const d = new Date(month)
      d.setMonth(d.getMonth() - 1)
      const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      let prevMeterMap: Record<string, any> = {}
      const { data: prevMeters } = await supabase
        .from('meter_readings')
        .select('*')
        .eq('billing_month', prevMonth)
        .in('room_id', roomIds)
      ;(prevMeters || []).forEach((m) => { prevMeterMap[m.room_id] = m })

      // Previous month bills for previous_due
      let prevBillMap: Record<string, any> = {}
      if (tenantIds.length) {
        const { data: prevBills } = await supabase
          .from('bills')
          .select('tenant_id, remaining_due')
          .eq('billing_month', prevMonth)
          .in('tenant_id', tenantIds)
        ;(prevBills || []).forEach((b) => { prevBillMap[b.tenant_id] = b })
      }

      const roomMap: Record<string, Room> = {}
      ;(rooms || []).forEach((r) => { roomMap[r.id] = r })

      const built: BillRow[] = (tenants || []).map((t) => {
        const room = t.room_id ? roomMap[t.room_id] : null
        const bill = billsMap[t.id]
        const meter = t.room_id ? meterMap[t.room_id] : null
        const prevMeter = t.room_id ? prevMeterMap[t.room_id] : null
        const prevBill = prevBillMap[t.id]

        const prevReading = meter?.previous_reading ?? prevMeter?.current_reading ?? 0
        const currReading = meter?.current_reading ?? 0
        const units = meter?.units_used ?? Math.max(0, currReading - prevReading)
        const rent = bill?.rent_amount ?? room?.monthly_rent ?? 4000
        const prevDue = bill?.previous_due ?? prevBill?.remaining_due ?? 0
        const other = bill?.other_charge ?? 0
        const discount = bill?.discount ?? 0
        const paid = bill?.amount_paid ?? 0
        const rateVal = bill?.electricity_rate ?? rate

        const calc = calculateBill({
          rent_amount: Number(rent),
          electricity_units: Number(units),
          electricity_rate: Number(rateVal),
          previous_due: Number(prevDue),
          other_charge: Number(other),
          discount: Number(discount),
          amount_paid: Number(paid),
        })

        return {
          id: bill?.id,
          tenant_id: t.id,
          room_id: t.room_id || '',
          billing_month: month,
          rent_amount: Number(rent),
          electricity_units: Number(units),
          electricity_rate: Number(rateVal),
          electricity_amount: calc.electricity_amount,
          previous_due: Number(prevDue),
          other_charge: Number(other),
          discount: Number(discount),
          total_bill: calc.total_bill,
          amount_paid: Number(paid),
          remaining_due: calc.remaining_due,
          status: calc.status,
          prev_reading: Number(prevReading),
          curr_reading: Number(currReading),
          tenant_name: t.full_name,
          room_number: room?.room_number || '—',
          phone: t.phone || '',
        }
      })

      setRows(built)
    } catch (e) {
      console.error(e)
      showToast('লোড করতে সমস্যা')
    } finally {
      setLoading(false)
    }
  }, [currentHouseId, month, rate])

  useEffect(() => { loadHousesAndRate() }, [loadHousesAndRate])
  useEffect(() => { loadBills() }, [loadBills])

  const updateRow = (idx: number, field: keyof BillRow, value: number | string) => {
    setRows((prev) => {
      const next = [...prev]
      const row = { ...next[idx], [field]: value }
      // Recalc when relevant fields change
      if (['prev_reading', 'curr_reading', 'rent_amount', 'previous_due', 'other_charge', 'discount', 'electricity_rate'].includes(field as string)) {
        const units = Math.max(0, Number(row.curr_reading) - Number(row.prev_reading))
        row.electricity_units = units
        const calc = calculateBill({
          rent_amount: Number(row.rent_amount),
          electricity_units: units,
          electricity_rate: Number(row.electricity_rate),
          previous_due: Number(row.previous_due),
          other_charge: Number(row.other_charge),
          discount: Number(row.discount),
          amount_paid: Number(row.amount_paid),
        })
        row.electricity_amount = calc.electricity_amount
        row.total_bill = calc.total_bill
        row.remaining_due = calc.remaining_due
        row.status = calc.status
      }
      next[idx] = row
      return next
    })
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const row of rows) {
        if (!row.room_id || !row.tenant_id) continue

        // Upsert meter reading
        await supabase.from('meter_readings').upsert(
          {
            room_id: row.room_id,
            billing_month: month,
            previous_reading: row.prev_reading,
            current_reading: row.curr_reading,
            created_by: profile?.id,
          },
          { onConflict: 'room_id,billing_month' }
        )

        // Upsert bill
        const billPayload = {
          tenant_id: row.tenant_id,
          room_id: row.room_id,
          billing_month: month,
          rent_amount: row.rent_amount,
          electricity_units: row.electricity_units,
          electricity_rate: row.electricity_rate,
          previous_due: row.previous_due,
          other_charge: row.other_charge,
          discount: row.discount,
          amount_paid: row.amount_paid,
          created_by: profile?.id,
        }

        if (row.id) {
          await supabase.from('bills').update(billPayload).eq('id', row.id)
        } else {
          await supabase.from('bills').upsert(billPayload, { onConflict: 'tenant_id,billing_month' })
        }
      }
      showToast('সেভ হয়েছে!')
      await loadBills()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'সেভ ব্যর্থ')
    } finally {
      setSaving(false)
    }
  }

  const openPay = (row: BillRow) => {
    setPayRow(row)
    setPayAmount('')
    setPayMethod('Cash')
    setPayNote('')
    setPayRef('')
    setPayOpen(true)
  }

  const confirmPay = async () => {
    if (!payRow) return
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      showToast('সঠিক অ্যামাউন্ট দিন')
      return
    }
    setSaving(true)
    try {
      // Ensure bill exists
      let billId = payRow.id
      if (!billId) {
        const { data, error } = await supabase
          .from('bills')
          .upsert(
            {
              tenant_id: payRow.tenant_id,
              room_id: payRow.room_id,
              billing_month: month,
              rent_amount: payRow.rent_amount,
              electricity_units: payRow.electricity_units,
              electricity_rate: payRow.electricity_rate,
              previous_due: payRow.previous_due,
              other_charge: payRow.other_charge,
              discount: payRow.discount,
              amount_paid: 0,
              created_by: profile?.id,
            },
            { onConflict: 'tenant_id,billing_month' }
          )
          .select('id')
          .single()
        if (error) throw error
        billId = data.id
      }

      const { error: pErr } = await supabase.from('payments').insert({
        tenant_id: payRow.tenant_id,
        bill_id: billId,
        amount,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: payMethod as any,
        transaction_reference: payRef || null,
        note: payNote || null,
        created_by: profile?.id,
      })
      if (pErr) throw pErr

      showToast(`৳${fmtBDT(amount)} যোগ হয়েছে`)
      setPayOpen(false)
      await loadBills()
    } catch (e: any) {
      console.error(e)
      showToast(e.message || 'পেমেন্ট ব্যর্থ')
    } finally {
      setSaving(false)
    }
  }

  const filtered = search
    ? rows.filter((r) => r.tenant_name.toLowerCase().includes(search.toLowerCase()))
    : rows

  // Summary
  let sumReceived = 0, sumDue = 0, sumEC = 0, sumRent = 0, sumTotal = 0
  rows.forEach((r) => {
    sumReceived += r.amount_paid
    sumDue += r.remaining_due
    sumEC += r.electricity_amount
    sumRent += r.rent_amount
    sumTotal += r.total_bill
  })
  const pct = sumTotal > 0 ? Math.min(100, Math.round((sumReceived / sumTotal) * 100)) : 0

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>Monthly Bills</h1>
            <div className="sub">{formatMonth(month)}</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>← Dashboard</Link>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value + '-01')}
            style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600 }}
          />
        </div>
      </div>

      <div className="page-content">
        {/* Summary cards */}
        <div className="grid-4" style={{ marginBottom: 12 }}>
          <div className="sum-card green"><div className="label">Received</div><div className="value">৳{fmtBDT(sumReceived)}</div></div>
          <div className="sum-card due"><div className="label">Due</div><div className="value">৳{fmtBDT(sumDue)}</div></div>
          <div className="sum-card blue"><div className="label">EC Bill</div><div className="value">৳{fmtBDT(sumEC)}</div></div>
          <div className="sum-card orange"><div className="label">Room Rent</div><div className="value">৳{fmtBDT(sumRent)}</div></div>
        </div>

        {/* Progress */}
        <div className="card" style={{ marginBottom: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
            <span>Collection Progress</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 10, background: '#e5e7eb', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), #00cec9)', borderRadius: 20, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* House tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 4 }}>
          {houses.map((h) => (
            <button
              key={h.id}
              className="btn"
              onClick={() => setCurrentHouseId(h.id)}
              style={{
                whiteSpace: 'nowrap',
                background: h.id === currentHouseId ? 'var(--primary)' : 'white',
                color: h.id === currentHouseId ? 'white' : 'var(--muted)',
                border: '1.5px solid var(--border)',
                fontSize: '0.78rem',
                padding: '7px 14px',
                borderRadius: 20,
              }}
            >
              {h.name.replace(' HOME', '')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search tenant name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'white', boxShadow: 'var(--shadow)' }}
          />
        </div>

        {loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} />লোড হচ্ছে...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            এই হাউসে কোনো টেন্যান্ট নেই।
            <br />
            <Link to="/admin/tenants" style={{ color: 'var(--primary)', fontWeight: 700 }}>টেন্যান্ট যোগ করুন →</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="tenant-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name / Room</th>
                    <th>Prev</th>
                    <th>New</th>
                    <th>Unit</th>
                    <th>EC</th>
                    <th>Rent</th>
                    <th>P.Due</th>
                    <th>Total</th>
                    <th>RCV</th>
                    <th>Due</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const realIdx = rows.indexOf(row)
                    const dueClass = row.remaining_due > 0 ? 'due-pos' : 'due-zero'
                    return (
                      <tr key={row.tenant_id} className={row.remaining_due > 1000 ? 'high-due' : ''}>
                        <td>{idx + 1}</td>
                        <td className="name-cell">
                          {row.tenant_name}
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 500 }}>
                            {row.room_number}{row.phone ? ` · ${row.phone}` : ''}
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.prev_reading}
                            onChange={(e) => updateRow(realIdx, 'prev_reading', Number(e.target.value))}
                            style={{ width: 56, padding: '5px 2px', border: '1.5px solid #e0e0e0', borderRadius: 6, textAlign: 'center', background: 'var(--yellow)', fontWeight: 600, fontSize: '0.74rem' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.curr_reading}
                            onChange={(e) => updateRow(realIdx, 'curr_reading', Number(e.target.value))}
                            style={{ width: 56, padding: '5px 2px', border: '1.5px solid #e0e0e0', borderRadius: 6, textAlign: 'center', background: 'var(--yellow)', fontWeight: 600, fontSize: '0.74rem' }}
                          />
                        </td>
                        <td style={{ background: 'var(--green)', fontWeight: 700, color: '#0d8050' }}>{row.electricity_units}</td>
                        <td style={{ background: 'var(--green)', fontWeight: 700, color: '#0d8050' }}>{fmtBDT(row.electricity_amount)}</td>
                        <td>
                          <input
                            type="number"
                            value={row.rent_amount}
                            onChange={(e) => updateRow(realIdx, 'rent_amount', Number(e.target.value))}
                            style={{ width: 56, padding: '5px 2px', border: '1.5px solid #e0e0e0', borderRadius: 6, textAlign: 'center', background: 'var(--yellow)', fontWeight: 600, fontSize: '0.74rem' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={row.previous_due}
                            onChange={(e) => updateRow(realIdx, 'previous_due', Number(e.target.value))}
                            style={{ width: 56, padding: '5px 2px', border: '1.5px solid #e0e0e0', borderRadius: 6, textAlign: 'center', background: 'var(--yellow)', fontWeight: 600, fontSize: '0.74rem' }}
                          />
                        </td>
                        <td className="total-cell">{fmtBDT(row.total_bill)}</td>
                        <td style={{ background: 'var(--green)', fontWeight: 700 }}>{fmtBDT(row.amount_paid)}</td>
                        <td className={dueClass}>{fmtBDT(row.remaining_due)}</td>
                        <td>
                          <button
                            className="btn btn-success"
                            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                            onClick={() => openPay(row)}
                          >
                            +Pay
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!search && (
                    <tr style={{ background: '#e8f0fe', fontWeight: 800 }}>
                      <td></td>
                      <td className="name-cell">TOTAL</td>
                      <td></td><td></td>
                      <td>{rows.reduce((s, r) => s + r.electricity_units, 0)}</td>
                      <td>{fmtBDT(sumEC)}</td>
                      <td>{fmtBDT(sumRent)}</td>
                      <td>{fmtBDT(rows.reduce((s, r) => s + r.previous_due, 0))}</td>
                      <td className="total-cell">{fmtBDT(sumTotal)}</td>
                      <td>{fmtBDT(sumReceived)}</td>
                      <td className={sumDue > 0 ? 'due-pos' : 'due-zero'}>{fmtBDT(sumDue)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1, padding: 12 }} onClick={saveAll} disabled={saving}>
            {saving ? 'সেভ হচ্ছে...' : '💾 Save'}
          </button>
          <Link to="/admin/tenants" className="btn btn-success" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
            + Tenant
          </Link>
        </div>
      </div>

      {/* Pay Modal */}
      {payOpen && payRow && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)',
          }}
          onClick={() => setPayOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 14, color: 'var(--primary)', fontWeight: 800 }}>Add Payment</h3>
            <p style={{ marginBottom: 12, fontWeight: 700, color: 'var(--primary)' }}>
              {payRow.tenant_name} · {payRow.room_number}
            </p>
            <div className="field">
              <label>Current Due</label>
              <input type="text" readOnly value={`৳${fmtBDT(payRow.remaining_due)}`} style={{ background: '#f5f5f5' }} />
            </div>
            <div className="field">
              <label>Already Received</label>
              <input type="text" readOnly value={`৳${fmtBDT(payRow.amount_paid)}`} style={{ background: '#f5f5f5' }} />
            </div>
            <div className="field">
              <label>Amount to Add (Tk)</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Enter amount" inputMode="numeric" />
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option>Cash</option>
                <option>bKash</option>
                <option>Nagad</option>
                <option>Bank</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>Transaction Ref (optional)</label>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="TrxID" />
            </div>
            <div className="field">
              <label>Note (optional)</label>
              <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. partial" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: 13, marginTop: 6 }} onClick={confirmPay} disabled={saving}>
              Confirm Payment
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setPayOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <div className={`toast show`}>{toast}</div>}

      <div className="bottom-nav">
        <Link to="/admin" className="nav-item"><span className="icon">📊</span>Dashboard</Link>
        <button className="nav-item active"><span className="icon">📋</span>Bills</button>
        <Link to="/admin/tenants" className="nav-item"><span className="icon">👥</span>Tenants</Link>
        <Link to="/admin" className="nav-item"><span className="icon">💰</span>Payments</Link>
      </div>
    </div>
  )
}
