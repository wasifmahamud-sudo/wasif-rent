import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { fmtBDT } from '../../lib/calculations'

interface House { id: string; name: string }
interface Room { id: string; house_id: string; room_number: string; monthly_rent: number; status: string }
interface TenantRow {
  id: string
  full_name: string
  phone: string | null
  room_id: string | null
  active: boolean
  room_number?: string
  house_name?: string
  monthly_rent?: number
}

export default function AdminTenants() {
  const { profile } = useAuth()
  const [houses, setHouses] = useState<House[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // Add tenant modal
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [houseId, setHouseId] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [rent, setRent] = useState('4000')
  const [saving, setSaving] = useState(false)

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const load = async () => {
    setLoading(true)
    const [h, r, t] = await Promise.all([
      supabase.from('houses').select('id, name').order('name'),
      supabase.from('rooms').select('id, house_id, room_number, monthly_rent, status'),
      supabase.from('tenants').select('id, full_name, phone, room_id, active').eq('active', true).order('full_name'),
    ])
    setHouses(h.data || [])
    setRooms(r.data || [])
    const roomMap: Record<string, Room & { house_name?: string }> = {}
    const houseMap: Record<string, string> = {}
    ;(h.data || []).forEach((x) => { houseMap[x.id] = x.name })
    ;(r.data || []).forEach((x) => { roomMap[x.id] = { ...x, house_name: houseMap[x.house_id] } })

    const rows: TenantRow[] = (t.data || []).map((tn) => {
      const rm = tn.room_id ? roomMap[tn.room_id] : null
      return {
        ...tn,
        room_number: rm?.room_number,
        house_name: rm?.house_name,
        monthly_rent: rm?.monthly_rent,
      }
    })
    setTenants(rows)
    if (h.data?.length && !houseId) setHouseId(h.data[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addTenant = async () => {
    if (!name.trim() || !houseId || !roomNumber.trim()) {
      showToast('নাম, হাউস ও রুম নম্বর দিন')
      return
    }
    setSaving(true)
    try {
      // Create or find room
      let roomId: string
      const existing = rooms.find((r) => r.house_id === houseId && r.room_number === roomNumber.trim())
      if (existing) {
        roomId = existing.id
        await supabase.from('rooms').update({ monthly_rent: Number(rent) || 4000, status: 'occupied' }).eq('id', roomId)
      } else {
        const { data, error } = await supabase
          .from('rooms')
          .insert({
            house_id: houseId,
            room_number: roomNumber.trim(),
            monthly_rent: Number(rent) || 4000,
            status: 'occupied',
          })
          .select('id')
          .single()
        if (error) throw error
        roomId = data.id
      }

      const { error: tErr } = await supabase.from('tenants').insert({
        full_name: name.trim(),
        phone: phone.trim() || null,
        room_id: roomId,
        active: true,
        move_in_date: new Date().toISOString().slice(0, 10),
      })
      if (tErr) throw tErr

      showToast('টেন্যান্ট যোগ হয়েছে')
      setOpen(false)
      setName('')
      setPhone('')
      setRoomNumber('')
      setRent('4000')
      await load()
    } catch (e: any) {
      showToast(e.message || 'যোগ করতে সমস্যা')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: string, tname: string) => {
    if (!confirm(`${tname} কে ডিঅ্যাকটিভ করবেন?`)) return
    await supabase.from('tenants').update({ active: false }).eq('id', id)
    showToast('ডিঅ্যাকটিভ করা হয়েছে')
    await load()
  }

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Tenants</h1>
            <div className="sub">{tenants.length} active tenants</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>← Dashboard</Link>
        </div>
      </div>

      <div className="page-content">
        <button className="btn btn-success" style={{ width: '100%', padding: 12, marginBottom: 14 }} onClick={() => setOpen(true)}>
          + Add Tenant
        </button>

        {loading ? (
          <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} />লোড হচ্ছে...</div>
        ) : tenants.length === 0 ? (
          <div className="empty">কোনো টেন্যান্ট নেই। + Add Tenant চাপুন।</div>
        ) : (
          tenants.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{t.full_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {t.house_name?.replace(' HOME', '')} · Room {t.room_number || '—'}
                  {t.phone ? ` · ${t.phone}` : ''}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: 2 }}>
                  Rent: ৳{fmtBDT(t.monthly_rent || 0)}
                </div>
              </div>
              <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => deactivate(t.id, t.full_name)}>
                Deactivate
              </button>
            </div>
          ))
        )}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 14, color: 'var(--primary)', fontWeight: 800 }}>Add Tenant</h3>
            <div className="field">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tenant name" />
            </div>
            <div className="field">
              <label>Mobile (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
            </div>
            <div className="field">
              <label>House</label>
              <select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Room Number</label>
              <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 1A, 3B" />
            </div>
            <div className="field">
              <label>Monthly Rent</label>
              <input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} onClick={addTenant} disabled={saving}>
              {saving ? 'সেভ হচ্ছে...' : 'Save Tenant'}
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {toast && <div className="toast show">{toast}</div>}

      <div className="bottom-nav">
        <Link to="/admin" className="nav-item"><span className="icon">📊</span>Dashboard</Link>
        <Link to="/admin/bills" className="nav-item"><span className="icon">📋</span>Bills</Link>
        <button className="nav-item active"><span className="icon">👥</span>Tenants</button>
        <Link to="/admin" className="nav-item"><span className="icon">💰</span>Payments</Link>
      </div>
    </div>
  )
}
