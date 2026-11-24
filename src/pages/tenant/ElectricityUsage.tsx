
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fmtBDT, formatMonth } from '../../lib/calculations'
import type { Bill } from '../../types/database'

type ElectricityBillRow = Pick<
  Bill,
  'id' | 'billing_month' | 'electricity_units' | 'electricity_rate' | 'electricity_amount'
>

type MeterReadingRow = {
  billing_month: string
  previous_reading: number | null
  current_reading: number | null
}

type MergedElectricityRow = ElectricityBillRow & {
  previous_reading: number | null
  current_reading: number | null
}

const PAGE_SIZE = 10

export default function ElectricityUsage() {
  const { user } = useAuth()

  const [allRows, setAllRows] = useState<MergedElectricityRow[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadElectricityUsage() {
      setLoading(true)
      setError('')

      try {
        let uid = user?.id
        if (!uid) {
          const { data: authData, error: authErr } = await supabase.auth.getUser()
          if (authErr) throw authErr
          uid = authData.user?.id
        }

        if (!uid) {
          if (active) {
            setError('আপনার অ্যাকাউন্ট পাওয়া যায়নি। আবার লগইন করুন।')
          }
          return
        }

        const { data: tenant, error: tenantErr } = await supabase
          .from('tenants')
          .select('id, room_id')
          .eq('user_id', uid)
          .eq('active', true)
          .maybeSingle()

        if (tenantErr) throw tenantErr

        if (!tenant) {
          if (active) {
            setError('আপনার টেন্যান্ট অ্যাকাউন্ট লিংক করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।')
          }
          return
        }

        if (tenant.room_id) {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('room_number')
            .eq('id', tenant.room_id)
            .maybeSingle()

          if (roomErr) throw roomErr
          if (active && room?.room_number) {
            setRoomNumber(String(room.room_number))
          }
        }

        const billsList: ElectricityBillRow[] = []
        const batchSize = 100
        let from = 0

        while (true) {
          const { data: batch, error: billsErr } = await supabase
            .from('bills')
            .select(
              'id, billing_month, electricity_units, electricity_rate, electricity_amount'
            )
            .eq('tenant_id', tenant.id)
            .order('billing_month', { ascending: false })
            .range(from, from + batchSize - 1)

          if (billsErr) throw billsErr

          const chunk = (batch || []) as ElectricityBillRow[]
          billsList.push(...chunk)

          if (chunk.length < batchSize) break
          from += batchSize
        }

        const readingsByMonth = new Map<string, MeterReadingRow>()

        if (tenant.room_id) {
          let rFrom = 0
          while (true) {
            const { data: rBatch, error: readingsErr } = await supabase
              .from('meter_readings')
              .select('billing_month, previous_reading, current_reading')
              .eq('room_id', tenant.room_id)
              .order('billing_month', { ascending: false })
              .range(rFrom, rFrom + batchSize - 1)

            if (readingsErr) throw readingsErr

            const rChunk = (rBatch || []) as MeterReadingRow[]
            rChunk.forEach((rec) => {
              readingsByMonth.set(String(rec.billing_month), rec)
            })

            if (rChunk.length < batchSize) break
            rFrom += batchSize
          }
        }

        const merged: MergedElectricityRow[] = billsList
          .map((bill) => {
            const monthKey = String(bill.billing_month)
            const reading =
              readingsByMonth.get(monthKey) ||
              Array.from(readingsByMonth.entries()).find(([k]) =>
                k.startsWith(monthKey.slice(0, 7))
              )?.[1]

            return {
              ...bill,
              previous_reading: reading?.previous_reading ?? null,
              current_reading: reading?.current_reading ?? null,
            }
          })
          .sort((a, b) =>
            String(b.billing_month).localeCompare(String(a.billing_month))
          )

        if (active) {
          setAllRows(merged)
          setCurrentPage(1)
        }
      } catch (e: unknown) {
        if (active) {
          const msg =
            e instanceof Error ? e.message : 'বিদ্যুতের তথ্য লোড করতে সমস্যা হয়েছে'
          setError(msg)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadElectricityUsage()

    return () => {
      active = false
    }
  }, [user?.id])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginatedRows = allRows.slice(startIndex, startIndex + PAGE_SIZE)

  return (
    <div>
      <div className="tenant-page-heading">
        <div>
          <h1>⚡ Electricity Usage</h1>
          <p>
            {roomNumber ? `Room: ${roomNumber} · ` : ''}
            মাস অনুযায়ী আপনার বিদ্যুতের ব্যবহার ও বিলের হিসাব (Read-only)
          </p>
        </div>
      </div>

      <div className="tenant-page-content-inner">
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!error && allRows.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: 20 }}>
              এখনো কোনো বিদ্যুতের ব্যবহার বা বিলের তথ্য পাওয়া যায়নি।
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {paginatedRows.map((item) => {
                const prevReading =
                  item.previous_reading !== null && item.previous_reading !== undefined
                    ? item.previous_reading
                    : '—'
                const currReading =
                  item.current_reading !== null && item.current_reading !== undefined
                    ? item.current_reading
                    : '—'
                const units = Number(item.electricity_units ?? 0)
                const rate = Number(item.electricity_rate ?? 0)
                const amount = Number(item.electricity_amount ?? 0)

                return (
                  <div key={item.id} className="card">
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        marginBottom: 8,
                        color: 'var(--primary)',
                      }}
                    >
                      {formatMonth(item.billing_month)}
                    </div>

                    <div className="bill-row">
                      <span>Billing Month</span>
                      <strong>{formatMonth(item.billing_month)}</strong>
                    </div>

                    <div className="bill-row">
                      <span>Previous Reading</span>
                      <strong>{prevReading}</strong>
                    </div>

                    <div className="bill-row">
                      <span>Current Reading</span>
                      <strong>{currReading}</strong>
                    </div>

                    <div className="bill-row">
                      <span>Electricity Units</span>
                      <strong>{units} Units</strong>
                    </div>

                    <div className="bill-row">
                      <span>Rate Per Unit</span>
                      <strong>৳{fmtBDT(rate)}</strong>
                    </div>

                    <div className="bill-row">
                      <span>Electricity Bill</span>
                      <strong>৳{fmtBDT(amount)}</strong>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginTop: 18,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ← আগের পাতা
                </button>

                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  পাতা {safePage} / {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  পরের পাতা →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
