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

      let meterMap: Record<string, any> = {}
      const { data: meters } = await supabase
        .from('meter_readings')
        .select('*')
        .eq('billing_month', month)
        .in('room_id', roomIds)
      ;(meters || []).forEach((m) => { meterMap[m.room_id] = m })

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
