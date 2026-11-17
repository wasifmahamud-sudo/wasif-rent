import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Complaint = {
  id: string
  tenant_id: string
  subject: string
  category: string
  description: string
  photo_url: string | null
  status: string
  admin_reply: string | null
  created_at: string
  updated_at: string
  tenant_name?: string
}

const STATUSES = ['New', 'In Progress', 'Resolved', 'Rejected'] as const

export default function AdminComplaints() {
  const [rows, setRows] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState('All')
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('complaints')
      .select('*, tenants(full_name)')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      showToast(error.message)
      setRows([])
    } else {
      const mapped = (data || []).map((r: Record<string, unknown>) => {
        const t = r.tenants as { full_name?: string } | null
        return {
          ...(r as unknown as Complaint),
          tenant_name: t?.full_name || '—',
        }
      })
      setRows(mapped)
      const drafts: Record<string, string> = {}
      mapped.forEach((c) => {
        drafts[c.id] = c.admin_reply || ''
      })
      setReplyDraft(drafts)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id)
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'Resolved') patch.resolved_at = new Date().toISOString()
    const { error } = await supabase.from('complaints').update(patch).eq('id', id)
    setSavingId(null)
    if (error) showToast(error.message)
    else {
      showToast('Status updated')
      await load()
    }
  }

  const saveReply = async (id: string) => {
    setSavingId(id)
    const { error } = await supabase
      .from('complaints')
      .update({
        admin_reply: replyDraft[id] || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    setSavingId(null)
    if (error) showToast(error.message)
    else showToast('Reply saved')
  }

  const filtered =
    filter === 'All' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <h1>Complaints</h1>
            <div className="sub">Tenant maintenance & issues</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="page-content">
        <div className="filter-row" style={{ marginBottom: 12 }}>
          {['All', ...STATUSES].map((s) => (
            <button
              key={s}
              type="button"
              className="btn"
              onClick={() => setFilter(s)}
              style={{
                whiteSpace: 'nowrap',
                background: filter === s ? 'var(--primary)' : 'var(--card)',
                color: filter === s ? '#fff' : 'var(--muted)',
                border: '1.5px solid var(--border)',
                fontSize: '0.78rem',
                padding: '7px 12px',
                borderRadius: 20,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            লোড হচ্ছে...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">কোনো complaint নেই</div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{c.subject}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                    {c.tenant_name} · {c.category} · {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
                <select
                  value={c.status}
                  disabled={savingId === c.id}
                  onChange={(e) => updateStatus(c.id, e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border)',
                    background: 'var(--input-bg, #fff)',
                    color: 'var(--input-text, #333)',
                    fontWeight: 700,
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{c.description}</div>
              {c.photo_url && (
                <div style={{ marginTop: 8, fontSize: '0.8rem' }}>
                  <a href={c.photo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    📷 Photo link
                  </a>
                </div>
              )}
              <div className="field" style={{ marginTop: 12, marginBottom: 8 }}>
                <label>Admin reply</label>
                <textarea
                  rows={2}
                  value={replyDraft[c.id] || ''}
                  onChange={(e) => setReplyDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                  placeholder="Reply to tenant..."
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '1.5px solid var(--border)',
                    background: 'var(--input-bg, var(--yellow))',
                    color: 'var(--input-text, #333)',
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 14px' }}
                disabled={savingId === c.id}
                onClick={() => saveReply(c.id)}
              >
                Save reply
              </button>
            </div>
          ))
        )}
      </div>

      {toast && <div className="toast show">{toast}</div>}

      <div className="bottom-nav">
        <Link to="/admin" className="nav-item">
          <span className="icon">📊</span>Dashboard
        </Link>
        <Link to="/admin/bills" className="nav-item">
          <span className="icon">📋</span>Bills
        </Link>
        <Link to="/admin/notices" className="nav-item">
          <span className="icon">📢</span>Notice
        </Link>
        <Link to="/admin/complaints" className="nav-item active">
          <span className="icon">🛠️</span>Complain
        </Link>
      </div>
    </div>
  )
}
