
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Notice = {
  id: string
  title: string
  body: string
  is_important: boolean
  published_at: string
  expiry_date: string | null
}

export default function TenantNotices() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadNotices()
  }, [])

  async function loadNotices() {
    setLoading(true)
    setError('')

    try {
      const today = new Date().toISOString().slice(0, 10)

      const { data, error: noticeError } = await supabase
        .from('notices')
        .select('id, title, body, is_important, published_at, expiry_date')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })

      if (noticeError) throw noticeError

      const activeNotices = (data || []).filter((notice) => {
        return !notice.expiry_date || notice.expiry_date >= today
      })

      setNotices(activeNotices as Notice[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'নোটিশ লোড করা যায়নি।'
      )
    } finally {
      setLoading(false)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  function isNew(date: string) {
    const published = new Date(date).getTime()
    const days = (Date.now() - published) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 7
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">নোটিশ লোড হচ্ছে...</div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Notice Board</h2>
          <p>বাড়ির সকল ঘোষণা ও গুরুত্বপূর্ণ নোটিশ</p>
        </div>

        <button className="btn btn-secondary" onClick={loadNotices}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {notices.length === 0 ? (
        <div className="card empty-state">
          <h3>No Notices</h3>
          <p>এই মুহূর্তে কোনো প্রকাশিত নোটিশ নেই।</p>
        </div>
      ) : (
        <div className="notice-list">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className={`card ${notice.is_important ? 'important-notice' : ''}`}
            >
              <div className="card-header">
                <div>
                  <h3>
                    {notice.is_important && '⭐ '}
                    {notice.title}
                  </h3>
                  <small>{formatDate(notice.published_at)}</small>
                </div>

                <div>
                  {notice.is_important && (
                    <span className="status-badge overdue">
                      Important
                    </span>
                  )}
                  {isNew(notice.published_at) && (
                    <span className="status-badge paid">NEW</span>
                  )}
                </div>
              </div>

              <p style={{ whiteSpace: 'pre-wrap' }}>
                {expandedId === notice.id
                  ? notice.body
                  : `${notice.body.slice(0, 180)}${notice.body.length > 180 ? '...' : ''}`}
              </p>

              {notice.body.length > 180 && (
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    setExpandedId(
                      expandedId === notice.id ? null : notice.id
                    )
                  }
                >
                  {expandedId === notice.id ? 'Show Less' : 'Read More'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
