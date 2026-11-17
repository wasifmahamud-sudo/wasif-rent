import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Notice = {
  id: string
  title: string
  body: string
  is_important: boolean
  is_active: boolean
  published_at: string
  expiry_date: string | null
  created_at: string
}

const emptyForm = {
  title: '',
  body: '',
  is_important: false,
  is_active: true,
  expiry_date: '',
}

export default function AdminNotices() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('published_at', { ascending: false })
    if (error) {
      console.error(error)
      showToast(error.message || 'Load failed')
    }
    setRows((data as Notice[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  const startEdit = (n: Notice) => {
    setEditingId(n.id)
    setForm({
      title: n.title,
      body: n.body,
      is_important: n.is_important,
      is_active: n.is_active,
      expiry_date: n.expiry_date || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast('Title ও Description লাগবে')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        is_important: form.is_important,
        is_active: form.is_active,
        expiry_date: form.expiry_date || null,
        updated_at: new Date().toISOString(),
        created_by: profile?.id || null,
      }
      if (editingId) {
        const { error } = await supabase.from('notices').update(payload).eq('id', editingId)
        if (error) throw error
        showToast('Notice updated')
      } else {
        const { error } = await supabase.from('notices').insert({
          ...payload,
          published_at: new Date().toISOString(),
        })
        if (error) throw error
        showToast('Notice created')
      }
      resetForm()
      await load()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      showToast(msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('এই notice মুছবেন?')) return
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) showToast(error.message)
    else {
      showToast('Deleted')
      await load()
    }
  }

  return (
    <div>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <h1>Notice Board</h1>
            <div className="sub">Create & manage tenant notices</div>
          </div>
          <Link to="/admin" className="btn btn-outline" style={{ padding: '8px 12px' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: 12 }}>
            {editingId ? 'Edit notice' : 'New notice'}
          </div>
          <div className="field">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Notice title"
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Notice details..."
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'var(--input-bg, var(--yellow))',
                color: 'var(--input-text, #333)',
              }}
            />
          </div>
          <div className="field">
            <label>Expiry date (optional)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.is_important}
                onChange={(e) => setForm((f) => ({ ...f, is_important: e.target.checked }))}
              />
              Important (highlight)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Publish'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            লোড হচ্ছে...
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">এখনো কোনো notice নেই</div>
        ) : (
          rows.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                marginBottom: 12,
                borderLeft: n.is_important ? '4px solid var(--danger)' : undefined,
                opacity: n.is_active ? 1 : 0.65,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    {n.is_important ? '⭐ ' : ''}
                    {n.title}
                    {!n.is_active && (
                      <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--muted)' }}>
                        (inactive)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                    {new Date(n.published_at).toLocaleString()}
                    {n.expiry_date ? ` · Expires ${n.expiry_date}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px' }}
                    onClick={() => startEdit(n)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '6px 10px' }}
                    onClick={() => remove(n.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{n.body}</div>
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
        <Link to="/admin/notices" className="nav-item active">
          <span className="icon">📢</span>Notice
        </Link>
        <Link to="/admin/complaints" className="nav-item">
          <span className="icon">🛠️</span>Complain
        </Link>
      </div>
    </div>
  )
}
