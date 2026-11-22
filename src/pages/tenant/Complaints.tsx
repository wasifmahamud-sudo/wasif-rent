
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Complaint = {
  id: string
  subject: string
  category: string
  description: string
  status: string
  admin_reply: string | null
  created_at: string
}

export default function TenantComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [tenantId, setTenantId] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('General')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadComplaints()
  }, [])

  async function loadComplaints() {
    setLoading(true)
    setError('')

    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('আপনার লগইন তথ্য পাওয়া যায়নি।')
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (tenantError) throw tenantError

      if (!tenant) {
        throw new Error('আপনার Tenant account পাওয়া যায়নি।')
      }

      setTenantId(tenant.id)

      const { data, error: complaintError } = await supabase
        .from('complaints')
        .select('id, subject, category, description, status, admin_reply, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })

      if (complaintError) throw complaintError

      setComplaints((data || []) as Complaint[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'অভিযোগ লোড করা যায়নি।'
      )
    } finally {
      setLoading(false)
    }
  }

  async function submitComplaint(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!tenantId || !subject.trim() || !description.trim()) {
      setMessage('সব প্রয়োজনীয় তথ্য পূরণ করুন।')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      let photoUrl: string | null = null

      if (photo) {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('লগইন পাওয়া যায়নি।')

        const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `${tenantId}/${Date.now()}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from('complaint-photos')
          .upload(filePath, photo, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('complaint-photos')
          .getPublicUrl(filePath)

        photoUrl = urlData.publicUrl
      }

      const { error: insertError } = await supabase
        .from('complaints')
        .insert({
          tenant_id: tenantId,
          subject: subject.trim(),
          category,
          description: description.trim(),
          photo_url: photoUrl,
          status: 'pending',
        })

      if (insertError) throw insertError

      setSubject('')
      setCategory('General')
      setDescription('')
      setPhoto(null)
      setMessage('আপনার অভিযোগ সফলভাবে জমা হয়েছে।')

      await loadComplaints()
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'অভিযোগ জমা দেওয়া যায়নি।'
      )
    } finally {
      setSaving(false)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function statusLabel(status: string) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) =>
      char.toUpperCase()
    )
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">অভিযোগ লোড হচ্ছে...</div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Complaint Box</h2>
          <p>আপনার সমস্যা বা অভিযোগ সরাসরি Admin-কে জানান</p>
        </div>

        <button className="btn btn-secondary" onClick={loadComplaints}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Submit New Complaint</h3>
        </div>

        <form onSubmit={submitComplaint}>
          <div className="form-group">
            <label>Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="অভিযোগের বিষয় লিখুন"
              required
            />
          </div>

          <div className="form-group">
            <label>Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="General">General</option>
              <option value="Electricity">Electricity</option>
              <option value="Water">Water</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Security">Security</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="আপনার সমস্যাটি বিস্তারিত লিখুন..."
              rows={5}
              required
            />
          </div>

          <div className="form-group">
            <label>Attach Photo (Optional)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] || null

                if (file && file.size > 5 * 1024 * 1024) {
                  setMessage('ছবির সাইজ ৫ MB-এর কম হতে হবে।')
                  e.target.value = ''
                  setPhoto(null)
                  return
                }

                setMessage('')
                setPhoto(file)
              }}
            />
            <small>JPG, PNG অথবা WebP। সর্বোচ্চ ৫ MB।</small>
            {photo && <p>Selected: {photo.name}</p>}
          </div>

          {message && <p>{message}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>My Complaint History</h3>
          <span>{complaints.length} complaints</span>
        </div>

        {complaints.length === 0 ? (
          <div className="empty-state">
            <h3>No Complaints Yet</h3>
            <p>আপনার কোনো অভিযোগ জমা নেই।</p>
          </div>
        ) : (
          <div className="notice-list">
            {complaints.map((complaint) => (
              <div className="card" key={complaint.id}>
                <div className="card-header">
                  <div>
                    <h3>{complaint.subject}</h3>
                    <small>
                      {complaint.category} · {formatDate(complaint.created_at)}
                    </small>
                  </div>

                  <span className="status-badge">
                    {statusLabel(complaint.status)}
                  </span>
                </div>

                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {complaint.description}
                </p>

                {complaint.admin_reply && (
                  <div className="card">
                    <strong>Admin Reply</strong>
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {complaint.admin_reply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
