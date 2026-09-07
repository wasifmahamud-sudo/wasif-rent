import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'

interface House { id: string; name: string }
type HouseStat = { id: string; name: string; income: number; expense: number; due: number; net: number }
type MonthRow = { key: string; label: string; income: number; expense: number; due: number; net: number }
type CatRow = { category: string; amount: number }

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AdminReports() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [houses, setHouses] = useState<House[]>([])
  const [loading, setLoading] = useState(true)
  const [monthIncome, setMonthIncome] = useState(0)
  const [monthExpense, setMonthExpense] = useState(0)
  const [monthDue, setMonthDue] = useState(0)
  const [yearIncome, setYearIncome] = useState(0)
  const [yearExpense, setYearExpense] = useState(0)
  const [yearDue, setYearDue] = useState(0)
  const [houseStats, setHouseStats] = useState<HouseStat[]>([])
  const [monthRows, setMonthRows] = useState<MonthRow[]>([])
  const [categories, setCategories] = useState<CatRow[]>([])
  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState('Maintenance')
  const [expNote, setExpNote] = useState('')
  const [expHouseId, setExpHouseId] = useState('')
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [recentExp, setRecentExp] = useState<any[]>([])

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = async () => {
    setLoading(true)
    try {
      const monthStart = `${month}-01`
      const yNum = Number(month.split('-')[0])
      const mNum = Number(month.split('-')[1])
      const nextMonth = mNum === 12 ? `${yNum + 1}-01-01` : `${yNum}-${String(mNum + 1).padStart(2, '0')}-01`
      const yearStart = `${year}-01-01`
      const yearEnd = `${Number(year) + 1}-01-01`

      const [hRes, payMonth, payYear, expMonth, expYear, billsMonth, billsYear, roomsRes, tenantsRes, expYearFull, expRecent] =
        await Promise.all([
          supabase.from('houses').select('id, name').order('name'),
          supabase.from('payments').select('amount, payment_date, tenant_id').gte('payment_date', monthStart).lt('payment_date', nextMonth),
          supabase.from('payments').select('amount, payment_date, tenant_id').gte('payment_date', yearStart).lt('payment_date', yearEnd),
          supabase.from('expenses').select('amount, expense_date, house_id, category').gte('expense_date', monthStart).lt('expense_date', nextMonth),
          supabase.from('expenses').select('amount, expense_date, house_id, category').gte('expense_date', yearStart).lt('expense_date', yearEnd),
          supabase.from('bills').select('remaining_due, room_id, amount_paid, billing_month').eq('billing_month', monthStart),
          supabase.from('bills').select('remaining_due, room_id, billing_month').gte('billing_month', yearStart).lt('billing_month', yearEnd),
          supabase.from('rooms').select('id, house_id'),
          supabase.from('tenants').select('id, room_id'),
          supabase.from('expenses').select('amount, expense_date, category, house_id').gte('expense_date', yearStart).lt('expense_date', yearEnd),
          supabase.from('expenses').select('id, amount, category, note, expense_date, house_id').order('expense_date', { ascending: false }).limit(20),
        ])

      const houseList = hRes.data || []
      setHouses(houseList)
      if (!expHouseId && houseList[0]) setExpHouseId(houseList[0].id)

      const sum = (arr: any[] | null | undefined, key: string) =>
        (arr || []).reduce((s, x) => s + Number(x[key] || 0), 0)

      setMonthIncome(sum(payMonth.data, 'amount'))
      setMonthExpense(sum(expMonth.data, 'amount'))
      setMonthDue(sum(billsMonth.data, 'remaining_due'))
      setYearIncome(sum(payYear.data, 'amount'))
      setYearExpense(sum(expYear.data, 'amount'))
      setYearDue(sum(billsYear.data, 'remaining_due'))

      const roomHouse: Record<string, string> = {}
      ;(roomsRes.data || []).forEach((r) => { roomHouse[r.id] = r.house_id })
      const tenantHouse: Record<string, string> = {}
      ;(tenantsRes.data || []).forEach((t) => {
        if (t.room_id && roomHouse[t.room_id]) tenantHouse[t.id] = roomHouse[t.room_id]
      })

      const byHouse: Record<string, { income: number; expense: number; due: number }> = {}
      houseList.forEach((h) => { byHouse[h.id] = { income: 0, expense: 0, due: 0 } })
      byHouse[''] = { income: 0, expense: 0, due: 0 }

      ;(payMonth.data || []).forEach((p) => {
        const hid = tenantHouse[p.tenant_id] || ''
        if (!byHouse[hid]) byHouse[hid] = { income: 0, expense: 0, due: 0 }
        byHouse[hid].income += Number(p.amount || 0)
      })
      ;(expMonth.data || []).forEach((e) => {
        const hid = e.house_id || ''
        if (!byHouse[hid]) byHouse[hid] = { income: 0, expense: 0, due: 0 }
        byHouse[hid].expense += Number(e.amount || 0)
      })
      ;(billsMonth.data || []).forEach((b) => {
        const hid = roomHouse[b.room_id] || ''
        if (!byHouse[hid]) byHouse[hid] = { income: 0, expense: 0, due: 0 }
        byHouse[hid].due += Number(b.remaining_due || 0)
      })

      const houseRows: HouseStat[] = houseList.map((h) => {
        const v = byHouse[h.id] || { income: 0, expense: 0, due: 0 }
        return { id: h.id, name: h.name, income: v.income, expense: v.expense, due: v.due, net: v.income - v.expense }
      })
      if (byHouse['']?.expense > 0) {
        houseRows.push({ id: 'general', name: 'General (no house)', income: 0, expense: byHouse[''].expense, due: 0, net: -byHouse[''].expense })
      }
      setHouseStats(houseRows)

      const monthly: MonthRow[] = []
      for (let mi = 1; mi <= 12; mi++) {
        const key = `${year}-${String(mi).padStart(2, '0')}`
        const start = `${key}-01`
        const end = mi === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(mi + 1).padStart(2, '0')}-01`
        const inc = (payYear.data || []).filter((p) => p.payment_date >= start && p.payment_date < end).reduce((s, p) => s + Number(p.amount || 0), 0)
        const exp = (expYearFull.data || []).filter((e) => e.expense_date >= start && e.expense_date < end).reduce((s, e) => s + Number(e.amount || 0), 0)
        const due = (billsYear.data || []).filter((b) => b.billing_month === start).reduce((s, b) => s + Number(b.remaining_due || 0), 0)
        monthly.push({ key, label: MONTH_NAMES[mi - 1], income: inc, expense: exp, due, net: inc - exp })
      }
      setMonthRows(monthly)

      const catMap: Record<string, number> = {}
      ;(expYearFull.data || []).forEach((e) => {
        const c = e.category || 'Other'
        catMap[c] = (catMap[c] || 0) + Number(e.amount || 0)
      })
      setCategories(Object.entries(catMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount))
      setRecentExp(expRecent.data || [])
    } catch (e) {
      console.error(e)
      showToast('Report load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month, year])

  const addExpense = async () => {
    const amount = Number(expAmount)
    if (!amount || amount <= 0) { showToast('সঠিক অ্যামাউন্ট দিন'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        amount, category: expCategory, note: expNote || null, expense_date: expDate, house_id: expHouseId || null,
      })
      if (error) throw error
      showToast('খরচ সেভ হয়েছে')
      setExpAmount('')
      setExpNote('')
      await load()
    } catch (e: any) {
      showToast(e.message || 'সেভ ব্যর্থ')
    } finally {
      setSaving(false)
    }
  }

  const netMonth = monthIncome - monthExpense
  const netYear = yearIncome - yearExpense
  const maxMonthBar = Math.max(1, ...monthRows.map((r) => Math.max(r.income, r.expense)))
  const maxCat = Math.max(1, ...categories.map((c) => c.amount))

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1>Income & Expense</h1>
            <div className="sub">Collected payments · BDT</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>← Dashboard</Link>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); if (e.target.value) setYear(e.target.value.slice(0, 4)) }}
            style={{ flex: 1, minWidth: 140, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontWeight: 600 }} />
          <select value={year} onChange={(e) => setYear(e.target.value)}
            style={{ flex: 1, minWidth: 100, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontWeight: 600 }}>
            {[2024, 2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} />লোড হচ্ছে...</div>
        ) : (
          <>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>This month ({month})</div>
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="sum-card green"><div className="label">Income</div><div className="value">৳{fmtBDT(monthIncome)}</div></div>
              <div className="sum-card due"><div className="label">Expense</div><div className="value">৳{fmtBDT(monthExpense)}</div></div>
              <div className="sum-card blue"><div className="label">Net</div><div className="value" style={{ color: netMonth >= 0 ? 'var(--accent)' : 'var(--danger)' }}>৳{fmtBDT(netMonth)}</div></div>
              <div className="sum-card orange"><div className="label">Due</div><div className="value">৳{fmtBDT(monthDue)}</div></div>
            </div>

            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>Year {year}</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="sum-card green"><div className="label">Year income</div><div className="value">৳{fmtBDT(yearIncome)}</div></div>
              <div className="sum-card due"><div className="label">Year expense</div><div className="value">৳{fmtBDT(yearExpense)}</div></div>
              <div className="sum-card blue"><div className="label">Year net</div><div className="value" style={{ color: netYear >= 0 ? 'var(--accent)' : 'var(--danger)' }}>৳{fmtBDT(netYear)}</div></div>
              <div className="sum-card orange"><div className="label">Year due</div><div className="value">৳{fmtBDT(yearDue)}</div></div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>{year} month-by-month</div>
              {monthRows.map((r) => (
                <div key={r.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, width: 36 }}>{r.label}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>৳{fmtBDT(r.income)}</span>
                      {' / '}<span style={{ color: '#c0392b' }}>৳{fmtBDT(r.expense)}</span>
                      {' · Net '}<span style={{ fontWeight: 700, color: r.net >= 0 ? 'var(--accent)' : '#c0392b' }}>৳{fmtBDT(r.net)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, height: 8 }}>
                    <div style={{ width: `${(r.income / maxMonthBar) * 100}%`, background: 'var(--accent)', borderRadius: 4, minWidth: r.income > 0 ? 4 : 0 }} />
                    <div style={{ width: `${(r.expense / maxMonthBar) * 100}%`, background: '#e17055', borderRadius: 4, minWidth: r.expense > 0 ? 4 : 0 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: 'var(--primary)' }}>House-wise ({month})</div>
              {houseStats.map((h) => (
                <div key={h.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{h.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                    <div>Income: <strong style={{ color: 'var(--accent)' }}>৳{fmtBDT(h.income)}</strong></div>
                    <div>Expense: <strong style={{ color: '#c0392b' }}>৳{fmtBDT(h.expense)}</strong></div>
                    <div>Net: <strong style={{ color: h.net >= 0 ? 'var(--accent)' : '#c0392b' }}>৳{fmtBDT(h.net)}</strong></div>
                    <div>Due: <strong style={{ color: h.due > 0 ? '#c0392b' : 'var(--muted)' }}>৳{fmtBDT(h.due)}</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>Expense by category ({year})</div>
              {categories.length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>No expenses this year</div>
              ) : categories.map((c) => (
                <div key={c.category} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{c.category}</span>
                    <span style={{ fontWeight: 800 }}>৳{fmtBDT(c.amount)}</span>
                  </div>
                  <div style={{ height: 10, background: '#e5e7eb', borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.amount / maxCat) * 100}%`, background: 'linear-gradient(90deg, #e17055, #d63031)', borderRadius: 20 }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, color: 'var(--primary)' }}>+ Add Expense</div>
              <div className="field"><label>Amount (Tk)</label>
                <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} inputMode="numeric" /></div>
              <div className="field"><label>Category</label>
                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                  <option>Maintenance</option><option>Electricity (Common)</option><option>Water</option>
                  <option>Tax</option><option>Salary</option><option>Repair</option><option>Other</option>
                </select></div>
              <div className="field"><label>House (optional)</label>
                <select value={expHouseId} onChange={(e) => setExpHouseId(e.target.value)}>
                  <option value="">All / General</option>
                  {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select></div>
              <div className="field"><label>Date</label>
                <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} /></div>
              <div className="field"><label>Note</label>
                <input type="text" value={expNote} onChange={(e) => setExpNote(e.target.value)} placeholder="optional" /></div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addExpense} disabled={saving}>
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 800, marginBottom: 10, color: 'var(--primary)' }}>Recent expenses</div>
              {recentExp.length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>No expenses yet</div>
              ) : recentExp.map((e) => (
                <div key={e.id} className="bill-row" style={{ padding: '8px 0' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{e.category}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{e.expense_date}{e.note ? ` · ${e.note}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#c0392b' }}>৳{fmtBDT(e.amount)}</div>
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
