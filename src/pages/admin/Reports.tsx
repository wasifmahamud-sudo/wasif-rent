import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'

interface House { id: string; name: string }

type HouseStat = {
  id: string
  name: string
  rentIncome: number
  otherIncome: number
  houseExpense: number
  profit: number
  due: number
}

type MonthRow = {
  key: string
  label: string
  rentIncome: number
  otherIncome: number
  totalIncome: number
  houseExpense: number
  personalExpense: number
  netCash: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const OTHER_INCOME_CATS = ['Shop Rent', 'Service Charge', 'Utility Collection', 'Advance/Other Income', 'Other']
const HOUSE_EXP_CATS = ['Maintenance', 'Electricity (Common)', 'Water', 'Tax', 'Salary', 'Repair', 'Other']
const PERSONAL_EXP_CATS = ['Food', 'Family', 'Transport', 'Mobile/Internet', 'Shopping', 'Child/Family', 'Personal', 'Other']

function prevMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export default function AdminReports() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  const [rentInc, setRentInc] = useState(0)
  const [otherInc, setOtherInc] = useState(0)
  const [houseExp, setHouseExp] = useState(0)
  const [personalExp, setPersonalExp] = useState(0)
  const [monthDue, setMonthDue] = useState(0)

  const [prevRent, setPrevRent] = useState(0)
  const [prevOther, setPrevOther] = useState(0)
  const [prevHouse, setPrevHouse] = useState(0)
  const [prevPersonal, setPrevPersonal] = useState(0)

  const [yRent, setYRent] = useState(0)
  const [yOther, setYOther] = useState(0)
  const [yHouse, setYHouse] = useState(0)
  const [yPersonal, setYPersonal] = useState(0)
  const [yearDue, setYearDue] = useState(0)

  const [houseStats, setHouseStats] = useState<HouseStat[]>([])
  const [monthRows, setMonthRows] = useState<MonthRow[]>([])
  const [recentOther, setRecentOther] = useState<any[]>([])
  const [recentHouse, setRecentHouse] = useState<any[]>([])
  const [recentPersonal, setRecentPersonal] = useState<any[]>([])

  const [oiDate, setOiDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [oiCat, setOiCat] = useState('Shop Rent')
  const [oiAmount, setOiAmount] = useState('')
  const [oiHouse, setOiHouse] = useState('')
  const [oiNote, setOiNote] = useState('')

  const [heDate, setHeDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [heCat, setHeCat] = useState('Maintenance')
  const [heAmount, setHeAmount] = useState('')
  const [heHouse, setHeHouse] = useState('')
  const [heNote, setHeNote] = useState('')

  const [peDate, setPeDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [peCat, setPeCat] = useState('Food')
  const [peAmount, setPeAmount] = useState('')
  const [peNote, setPeNote] = useState('')

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2500)
  }

  const rangeForYm = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    const start = `${ym}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    return { start, end }
  }

  const load = async () => {
    setLoading(true)
    try {
      const { start: monthStart, end: nextMonth } = rangeForYm(month)
      const prevYm = prevMonthKey(month)
      const { start: prevStart, end: prevEnd } = rangeForYm(prevYm)
      const yearStart = `${year}-01-01`
      const yearEnd = `${Number(year) + 1}-01-01`

      const [
        hRes,
        payM, payP, payY,
        oiM, oiP, oiY,
        expAllM, expAllP, expAllY,
        billsM, billsY,
        roomsRes, tenantsRes,
        oiRecent, expRecent,
      ] = await Promise.all([
        supabase.from('houses').select('id, name').order('name'),
        supabase.from('payments').select('amount, payment_date, tenant_id').gte('payment_date', monthStart).lt('payment_date', nextMonth),
        supabase.from('payments').select('amount, payment_date, tenant_id').gte('payment_date', prevStart).lt('payment_date', prevEnd),
        supabase.from('payments').select('amount, payment_date, tenant_id').gte('payment_date', yearStart).lt('payment_date', yearEnd),
        supabase.from('other_income').select('amount, income_date, house_id, category').gte('income_date', monthStart).lt('income_date', nextMonth),
        supabase.from('other_income').select('amount, income_date, house_id').gte('income_date', prevStart).lt('income_date', prevEnd),
        supabase.from('other_income').select('amount, income_date, house_id, category').gte('income_date', yearStart).lt('income_date', yearEnd),
        supabase.from('expenses').select('amount, expense_date, house_id, category, expense_scope').gte('expense_date', monthStart).lt('expense_date', nextMonth),
        supabase.from('expenses').select('amount, expense_date, house_id, expense_scope').gte('expense_date', prevStart).lt('expense_date', prevEnd),
        supabase.from('expenses').select('amount, expense_date, house_id, category, expense_scope').gte('expense_date', yearStart).lt('expense_date', yearEnd),
        supabase.from('bills').select('remaining_due, room_id').eq('billing_month', monthStart),
        supabase.from('bills').select('remaining_due, room_id, billing_month').gte('billing_month', yearStart).lt('billing_month', yearEnd),
        supabase.from('rooms').select('id, house_id'),
        supabase.from('tenants').select('id, room_id'),
        supabase.from('other_income').select('id, amount, category, note, income_date, house_id').order('income_date', { ascending: false }).limit(10),
        supabase.from('expenses').select('id, amount, category, note, expense_date, house_id, expense_scope').order('expense_date', { ascending: false }).limit(20),
      ])

      if (oiM.error && String(oiM.error.message || '').includes('other_income')) {
        showToast('Run Other Income SQL first')
      }

      const houseList = hRes.data || []
      setHouses(houseList)
      if (!oiHouse && houseList[0]) setOiHouse(houseList[0].id)
      if (!heHouse && houseList[0]) setHeHouse(houseList[0].id)

      const sum = (arr: any[] | null | undefined, key = 'amount') =>
        (arr || []).reduce((s, x) => s + Number(x[key] || 0), 0)

      const houseOnly = (arr: any[] | null | undefined) =>
        (arr || []).filter((e) => !e.expense_scope || e.expense_scope === 'house')
      const personalOnly = (arr: any[] | null | undefined) =>
        (arr || []).filter((e) => e.expense_scope === 'personal')

      setRentInc(sum(payM.data))
      setOtherInc(sum(oiM.data))
      setHouseExp(sum(houseOnly(expAllM.data)))
      setPersonalExp(sum(personalOnly(expAllM.data)))
      setMonthDue(sum(billsM.data, 'remaining_due'))

      setPrevRent(sum(payP.data))
      setPrevOther(sum(oiP.data))
      setPrevHouse(sum(houseOnly(expAllP.data)))
      setPrevPersonal(sum(personalOnly(expAllP.data)))

      setYRent(sum(payY.data))
      setYOther(sum(oiY.data))
      setYHouse(sum(houseOnly(expAllY.data)))
      setYPersonal(sum(personalOnly(expAllY.data)))
      setYearDue(sum(billsY.data, 'remaining_due'))

      const roomHouse: Record<string, string> = {}
      ;(roomsRes.data || []).forEach((r) => { roomHouse[r.id] = r.house_id })
      const tenantHouse: Record<string, string> = {}
      ;(tenantsRes.data || []).forEach((t) => {
        if (t.room_id && roomHouse[t.room_id]) tenantHouse[t.id] = roomHouse[t.room_id]
      })

      const byH: Record<string, { rent: number; other: number; exp: number; due: number }> = {}
      houseList.forEach((h) => { byH[h.id] = { rent: 0, other: 0, exp: 0, due: 0 } })

      ;(payM.data || []).forEach((p) => {
        const hid = tenantHouse[p.tenant_id]
        if (hid && byH[hid]) byH[hid].rent += Number(p.amount || 0)
      })
      ;(oiM.data || []).forEach((o) => {
        if (o.house_id && byH[o.house_id]) byH[o.house_id].other += Number(o.amount || 0)
      })
      houseOnly(expAllM.data).forEach((e) => {
        if (e.house_id && byH[e.house_id]) byH[e.house_id].exp += Number(e.amount || 0)
      })
      ;(billsM.data || []).forEach((b) => {
        const hid = roomHouse[b.room_id]
        if (hid && byH[hid]) byH[hid].due += Number(b.remaining_due || 0)
      })

      setHouseStats(
        houseList.map((h) => {
          const v = byH[h.id]
          const income = v.rent + v.other
          return {
            id: h.id,
            name: h.name,
            rentIncome: v.rent,
            otherIncome: v.other,
            houseExpense: v.exp,
            profit: income - v.exp,
            due: v.due,
          }
        })
      )

      const rows: MonthRow[] = []
      for (let mi = 1; mi <= 12; mi++) {
        const key = `${year}-${String(mi).padStart(2, '0')}`
        const { start, end } = rangeForYm(key)
        const rInc = (payY.data || []).filter((p) => p.payment_date >= start && p.payment_date < end).reduce((s, p) => s + Number(p.amount || 0), 0)
        const oInc = (oiY.data || []).filter((o) => o.income_date >= start && o.income_date < end).reduce((s, o) => s + Number(o.amount || 0), 0)
        const hExp = houseOnly(expAllY.data).filter((e) => e.expense_date >= start && e.expense_date < end).reduce((s, e) => s + Number(e.amount || 0), 0)
        const pExp = personalOnly(expAllY.data).filter((e) => e.expense_date >= start && e.expense_date < end).reduce((s, e) => s + Number(e.amount || 0), 0)
        const total = rInc + oInc
        rows.push({
          key,
          label: MONTH_NAMES[mi - 1],
          rentIncome: rInc,
          otherIncome: oInc,
          totalIncome: total,
          houseExpense: hExp,
          personalExpense: pExp,
          netCash: total - hExp - pExp,
        })
      }
      setMonthRows(rows)

      setRecentOther(oiRecent.data || [])
      const allExp = expRecent.data || []
      setRecentHouse(allExp.filter((e) => !e.expense_scope || e.expense_scope === 'house'))
      setRecentPersonal(allExp.filter((e) => e.expense_scope === 'personal'))
    } catch (e) {
      console.error(e)
      showToast('Load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  const addOtherIncome = async () => {
    const amount = Number(oiAmount)
    if (!amount || amount <= 0) { showToast('সঠিক অ্যামাউন্ট দিন'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('other_income').insert({
        amount,
        category: oiCat,
        note: oiNote || null,
        income_date: oiDate,
        house_id: oiHouse || null,
      })
      if (error) throw error
      showToast('Other Income saved')
      setOiAmount('')
      setOiNote('')
      await load()
    } catch (e: any) {
      showToast(e.message || 'Failed — run SQL if table missing')
    } finally {
      setSaving(false)
    }
  }

  const addHouseExpense = async () => {
    const amount = Number(heAmount)
    if (!amount || amount <= 0) { showToast('সঠিক অ্যামাউন্ট দিন'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        amount,
        category: heCat,
        note: heNote || null,
        expense_date: heDate,
        house_id: heHouse || null,
        expense_scope: 'house',
      })
      if (error) throw error
      showToast('House Expense saved')
      setHeAmount('')
      setHeNote('')
      await load()
    } catch (e: any) {
      showToast(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addPersonalExpense = async () => {
    const amount = Number(peAmount)
    if (!amount || amount <= 0) { showToast('সঠিক অ্যামাউন্ট দিন'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        amount,
        category: peCat,
        note: peNote || null,
        expense_date: peDate,
        house_id: null,
        expense_scope: 'personal',
      })
      if (error) throw error
      showToast('Personal Expense saved')
      setPeAmount('')
      setPeNote('')
      await load()
    } catch (e: any) {
      showToast(e.message || 'Save failed — run expense_scope SQL')
    } finally {
      setSaving(false)
    }
  }

  const totalIncome = rentInc + otherInc
  const houseProfit = totalIncome - houseExp
  const netCash = totalIncome - houseExp - personalExp

  const prevTotal = prevRent + prevOther
  const prevProfit = prevTotal - prevHouse
  const prevNet = prevTotal - prevHouse - prevPersonal

  const yTotal = yRent + yOther
  const yProfit = yTotal - yHouse
  const yNet = yTotal - yHouse - yPersonal

  const maxBar = Math.max(1, ...monthRows.map((r) => Math.max(r.totalIncome, r.houseExpense, r.personalExpense)))

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>Income & Expense</h1>
            <div className="sub">Rent · Other Income · House · Personal</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>← Dashboard</Link>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              if (e.target.value) setYear(e.target.value.slice(0, 4))
            }}
            style={{ flex: 1, minWidth: 140, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontWeight: 600 }}
          />
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontWeight: 600 }}
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} />লোড হচ্ছে...</div>
        ) : (
          <>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Current month ({month})</div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="sum-card green"><div className="label">Rent Income</div><div className="value">৳{fmtBDT(rentInc)}</div></div>
              <div className="sum-card blue"><div className="label">Other Income</div><div className="value">৳{fmtBDT(otherInc)}</div></div>
              <div className="sum-card green"><div className="label">Total Income</div><div className="value">৳{fmtBDT(totalIncome)}</div></div>
              <div className="sum-card due"><div className="label">House Expense</div><div className="value">৳{fmtBDT(houseExp)}</div></div>
              <div className="sum-card orange"><div className="label">House Profit</div><div className="value" style={{ color: houseProfit >= 0 ? 'var(--accent)' : 'var(--danger)' }}>৳{fmtBDT(houseProfit)}</div></div>
              <div className="sum-card due"><div className="label">Personal Expense</div><div className="value">৳{fmtBDT(personalExp)}</div></div>
              <div className="sum-card blue"><div className="label">Net Cash Flow</div><div className="value" style={{ color: netCash >= 0 ? 'var(--accent)' : 'var(--danger)' }}>৳{fmtBDT(netCash)}</div></div>
              <div className="sum-card orange"><div className="label">Due (bills)</div><div className="value">৳{fmtBDT(monthDue)}</div></div>
            </div>

            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Previous month ({prevMonthKey(month)})</div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="sum-card"><div className="label">Total Income</div><div className="value">৳{fmtBDT(prevTotal)}</div></div>
              <div className="sum-card"><div className="label">House Expense</div><div className="value">৳{fmtBDT(prevHouse)}</div></div>
              <div className="sum-card"><div className="label">House Profit</div><div className="value">৳{fmtBDT(prevProfit)}</div></div>
              <div className="sum-card"><div className="label">Net Cash</div><div className="value">৳{fmtBDT(prevNet)}</div></div>
            </div>

            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Year {year}</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="sum-card green"><div className="label">Rent Income</div><div className="value">৳{fmtBDT(yRent)}</div></div>
              <div className="sum-card blue"><div className="label">Other Income</div><div className="value">৳{fmtBDT(yOther)}</div></div>
              <div className="sum-card green"><div className="label">Total Income</div><div className="value">৳{fmtBDT(yTotal)}</div></div>
              <div className="sum-card due"><div className="label">House Expense</div><div className="value">৳{fmtBDT(yHouse)}</div></div>
              <div className="sum-card orange"><div className="label">House Profit</div><div className="value">৳{fmtBDT(yProfit)}</div></div>
              <div className="sum-card due"><div className="label">Personal Expense</div><div className="value">৳{fmtBDT(yPersonal)}</div></div>
              <div className="sum-card blue"><div className="label">Net Cash Flow</div><div className="value">৳{fmtBDT(yNet)}</div></div>
              <div className="sum-card orange"><div className="label">Year Due</div><div className="value">৳{fmtBDT(yearDue)}</div></div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>{year} month-by-month</div>
              {monthRows.map((r) => (
                <div key={r.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontWeight: 700, width: 32 }}>{r.label}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      Inc ৳{fmtBDT(r.totalIncome)} · H.Exp ৳{fmtBDT(r.houseExpense)} · P.Exp ৳{fmtBDT(r.personalExpense)} ·{' '}
                      <strong style={{ color: r.netCash >= 0 ? 'var(--accent)' : '#c0392b' }}>Net ৳{fmtBDT(r.netCash)}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3, height: 8 }}>
                    <div style={{ width: `${(r.totalIncome / maxBar) * 100}%`, background: 'var(--accent)', borderRadius: 4, minWidth: r.totalIncome > 0 ? 3 : 0 }} />
                    <div style={{ width: `${(r.houseExpense / maxBar) * 100}%`, background: '#e17055', borderRadius: 4, minWidth: r.houseExpense > 0 ? 3 : 0 }} />
                    <div style={{ width: `${(r.personalExpense / maxBar) * 100}%`, background: '#6c5ce7', borderRadius: 4, minWidth: r.personalExpense > 0 ? 3 : 0 }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.7rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span><span style={{ color: 'var(--accent)' }}>■</span> Income</span>
                <span><span style={{ color: '#e17055' }}>■</span> House Exp</span>
                <span><span style={{ color: '#6c5ce7' }}>■</span> Personal</span>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: 'var(--primary)' }}>House-wise ({month})</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8 }}>Personal expense is NOT included here</div>
              {houseStats.map((h) => (
                <div key={h.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{h.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                    <div>Rent: <strong style={{ color: 'var(--accent)' }}>৳{fmtBDT(h.rentIncome)}</strong></div>
                    <div>Other: <strong>৳{fmtBDT(h.otherIncome)}</strong></div>
                    <div>Expense: <strong style={{ color: '#c0392b' }}>৳{fmtBDT(h.houseExpense)}</strong></div>
                    <div>Profit: <strong style={{ color: h.profit >= 0 ? 'var(--accent)' : '#c0392b' }}>৳{fmtBDT(h.profit)}</strong></div>
                    <div>Due: <strong style={{ color: h.due > 0 ? '#c0392b' : 'var(--muted)' }}>৳{fmtBDT(h.due)}</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8, fontSize: '1rem' }}>Income</div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>+ Add Other Income</div>
              <div className="field"><label>Date</label>
                <input type="date" value={oiDate} onChange={(e) => setOiDate(e.target.value)} /></div>
              <div className="field"><label>Category</label>
                <select value={oiCat} onChange={(e) => setOiCat(e.target.value)}>
                  {OTHER_INCOME_CATS.map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div className="field"><label>Amount (Tk)</label>
                <input type="number" value={oiAmount} onChange={(e) => setOiAmount(e.target.value)} inputMode="numeric" /></div>
              <div className="field"><label>House (optional)</label>
                <select value={oiHouse} onChange={(e) => setOiHouse(e.target.value)}>
                  <option value="">None / General</option>
                  {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select></div>
              <div className="field"><label>Note</label>
                <input type="text" value={oiNote} onChange={(e) => setOiNote(e.target.value)} placeholder="optional" /></div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addOtherIncome} disabled={saving}>
                {saving ? 'Saving...' : 'Save Other Income'}
              </button>
            </div>

            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8, fontSize: '1rem' }}>Expense</div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>+ Add House Expense</div>
              <div className="field"><label>Date</label>
                <input type="date" value={heDate} onChange={(e) => setHeDate(e.target.value)} /></div>
              <div className="field"><label>Category</label>
                <select value={heCat} onChange={(e) => setHeCat(e.target.value)}>
                  {HOUSE_EXP_CATS.map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div className="field"><label>Amount (Tk)</label>
                <input type="number" value={heAmount} onChange={(e) => setHeAmount(e.target.value)} inputMode="numeric" /></div>
              <div className="field"><label>House (optional)</label>
                <select value={heHouse} onChange={(e) => setHeHouse(e.target.value)}>
                  <option value="">All / General</option>
                  {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select></div>
              <div className="field"><label>Note</label>
                <input type="text" value={heNote} onChange={(e) => setHeNote(e.target.value)} placeholder="optional" /></div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addHouseExpense} disabled={saving}>
                {saving ? 'Saving...' : 'Save House Expense'}
              </button>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>+ Add Personal Expense</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8 }}>Not counted in House Profit</div>
              <div className="field"><label>Date</label>
                <input type="date" value={peDate} onChange={(e) => setPeDate(e.target.value)} /></div>
              <div className="field"><label>Category</label>
                <select value={peCat} onChange={(e) => setPeCat(e.target.value)}>
                  {PERSONAL_EXP_CATS.map((c) => <option key={c}>{c}</option>)}
                </select></div>
              <div className="field"><label>Amount (Tk)</label>
                <input type="number" value={peAmount} onChange={(e) => setPeAmount(e.target.value)} inputMode="numeric" /></div>
              <div className="field"><label>Note</label>
                <input type="text" value={peNote} onChange={(e) => setPeNote(e.target.value)} placeholder="optional" /></div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addPersonalExpense} disabled={saving}>
                {saving ? 'Saving...' : 'Save Personal Expense'}
              </button>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: 'var(--primary)' }}>Recent Other Income</div>
              {recentOther.length === 0 ? <div className="empty" style={{ padding: 12 }}>None yet</div> : recentOther.map((e) => (
                <div key={e.id} className="bill-row" style={{ padding: '8px 0' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{e.category}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{e.income_date}{e.note ? ` · ${e.note}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--accent)' }}>৳{fmtBDT(e.amount)}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: 'var(--primary)' }}>Recent House Expenses</div>
              {recentHouse.length === 0 ? <div className="empty" style={{ padding: 12 }}>None yet</div> : recentHouse.map((e) => (
                <div key={e.id} className="bill-row" style={{ padding: '8px 0' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{e.category}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{e.expense_date}{e.note ? ` · ${e.note}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#c0392b' }}>৳{fmtBDT(e.amount)}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: 'var(--primary)' }}>Recent Personal Expenses</div>
              {recentPersonal.length === 0 ? <div className="empty" style={{ padding: 12 }}>None yet</div> : recentPersonal.map((e) => (
                <div key={e.id} className="bill-row" style={{ padding: '8px 0' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{e.category}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{e.expense_date}{e.note ? ` · ${e.note}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#6c5ce7' }}>৳{fmtBDT(e.amount)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}

      <div className="bottom-nav">
        <Link to="/admin" className="nav-item"><span className="icon">📊</span>Dashboard</Link>
        <Link to="/admin/bills" className="nav-item"><span className="icon">📋</span>Bills</Link>
        <Link to="/admin/reports" className="nav-item active"><span className="icon">📈</span>Reports</Link>
        <Link to="/admin/reminders" className="nav-item"><span className="icon">🔔</span>Remind</Link>
      </div>
    </div>
  )
}
