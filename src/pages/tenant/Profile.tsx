
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtBDT } from '../../lib/calculations'

type TenantProfile = {
  full_name: string
  phone: string | null
  move_in_date: string | null
  deposit: number | null
  room_id: string | null
  rooms: {
    room_number: string
    monthly_rent: number
    houses: {
      name: string
      address: string | null
    } | null
  } | null
}

export default function TenantProfilePage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    setError('')

    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('আপনার লগইন তথ্য পাওয়া যায়নি।')
      }

      const { data, error: profileError } = await supabase
        .from('tenants')
        .select(`
          full_name,
          phone,
          move_in_date,
          deposit,
          room_id,
          rooms (
            room_number,
            monthly_rent,
            houses (
              name,
              address
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (profileError) throw profileError

      if (!data) {
        throw new Error('আপনার Tenant profile পাওয়া যায়নি।')
      }

      const row = data as unknown as TenantProfile
      setProfile(row)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'প্রোফাইল লোড করা যায়নি।'
      )
    } finally {
      setLoading(false)
    }
  }

  function formatDate(date: string | null) {
    if (!date) return 'তথ্য নেই'

    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">প্রোফাইল লোড হচ্ছে...</div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>My Profile</h2>
          <p>আপনার ব্যক্তিগত ও বাসা সংক্রান্ত তথ্য</p>
        </div>

        <button className="btn btn-secondary" onClick={loadProfile}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {profile && (
        <>
          <div className="card">
            <div className="card-header">
              <h3>Personal Information</h3>
            </div>

            <div className="stats-grid">
              <div>
                <div className="stat-label">Full Name</div>
                <strong>{profile.full_name}</strong>
              </div>

              <div>
                <div className="stat-label">Phone Number</div>
                <strong>{profile.phone || 'তথ্য নেই'}</strong>
              </div>

              <div>
                <div className="stat-label">Tenant Status</div>
                <strong>Active</strong>
              </div>

              <div>
                <div className="stat-label">Joining Date</div>
                <strong>{formatDate(profile.move_in_date)}</strong>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Rental Information</h3>
            </div>

            <div className="stats-grid">
              <div>
                <div className="stat-label">House Name</div>
                <strong>{profile.rooms?.houses?.name || 'তথ্য নেই'}</strong>
              </div>

              <div>
                <div className="stat-label">Room Number</div>
                <strong>{profile.rooms?.room_number || 'তথ্য নেই'}</strong>
              </div>

              <div>
                <div className="stat-label">Monthly Rent</div>
                <strong>{fmtBDT(Number(profile.rooms?.monthly_rent || 0))}</strong>
              </div>

              <div>
                <div className="stat-label">Security Deposit</div>
                <strong>{fmtBDT(Number(profile.deposit || 0))}</strong>
              </div>
            </div>

            {profile.rooms?.houses?.address && (
              <p>
                <strong>Address:</strong> {profile.rooms.houses.address}
              </p>
            )}
          </div>

          <div className="card">
            <p>
              <strong>Note:</strong> আপনার প্রোফাইলের তথ্য পরিবর্তন করতে
              হলে বাড়ির প্রশাসকের সঙ্গে যোগাযোগ করুন।
            </p>
          </div>
        </>
      )}
    </div>
  )
}
