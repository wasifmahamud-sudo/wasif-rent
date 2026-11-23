
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

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

      setProfile(data as unknown as TenantProfile)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'প্রোফাইল লোড করা যায়নি।'
      )
      setProfile(null)
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

  function InfoItem({
    label,
    value,
    icon,
  }: {
    label: string
    value: string
    icon: string
  }) {
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: '10px',
          background: 'var(--bg)',
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: '20px', marginBottom: '9px' }}>
          {icon}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            marginBottom: '6px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
          আপনার প্রোফাইল লোড হচ্ছে...
        </div>
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

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadProfile}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadProfile}
            style={{ marginTop: '10px' }}
          >
            Try Again
          </button>
        </div>
      )}

      {profile && (
        <>
          <div
            className="card"
            style={{
              padding: '22px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: '62px',
                height: '62px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '25px',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {(profile.full_name || 'T').trim().charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>
                {profile.full_name}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '5px' }}>
                Tenant Account
              </p>
            </div>

            <span className="status-badge paid">
              Active Tenant
            </span>
          </div>

          <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
            <div className="card-header">
              <h3>Personal Information</h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                gap: '14px',
              }}
            >
              <InfoItem
                label="Full Name"
                value={profile.full_name || 'তথ্য নেই'}
                icon="👤"
              />

              <InfoItem
                label="Phone Number"
                value={profile.phone || 'তথ্য নেই'}
                icon="📞"
              />

              <InfoItem
                label="Joining Date"
                value={formatDate(profile.move_in_date)}
                icon="📅"
              />

              <InfoItem
                label="Tenant Status"
                value="Active"
                icon="✓"
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
            <div className="card-header">
              <h3>Rental Information</h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
                gap: '14px',
              }}
            >
              <InfoItem
                label="House Name"
                value={profile.rooms?.houses?.name || 'তথ্য নেই'}
                icon="🏠"
              />

              <InfoItem
                label="Room Number"
                value={profile.rooms?.room_number || 'তথ্য নেই'}
                icon="🚪"
              />

              <InfoItem
                label="Monthly Rent"
                value={fmtBDT(Number(profile.rooms?.monthly_rent || 0))}
                icon="💰"
              />

              <InfoItem
                label="Security Deposit"
                value={fmtBDT(Number(profile.deposit || 0))}
                icon="🔐"
              />
            </div>

            {profile.rooms?.houses?.address && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '15px',
                  borderRadius: '10px',
                  background: 'var(--bg)',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  📍 House Address
                </div>
                <div style={{ fontWeight: 600, marginTop: '6px' }}>
                  {profile.rooms.houses.address}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '18px' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.7 }}>
              <strong>ℹ️ Profile Information:</strong> আপনার প্রোফাইলের
              তথ্য পরিবর্তন করতে হলে বাড়ির প্রশাসকের সঙ্গে যোগাযোগ করুন।
              এই পেজ থেকে কোনো ব্যক্তিগত তথ্য পরিবর্তন করা যাবে না।
            </p>
          </div>
        </>
      )}
    </div>
  )
}
