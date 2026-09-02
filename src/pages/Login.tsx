import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [message, setMessage] = useState('')
  const { signIn, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  if (!authLoading && profile) {
    navigate(profile.role === 'admin' ? '/admin' : '/tenant', { replace: true })
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError(error.message || 'লগইন ব্যর্থ হয়েছে')
      return
    }
    // AuthContext will update profile; useEffect / re-render handles redirect
  }

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!email.trim()) {
      setError('ইমেইল দিন')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/login',
    })
    setLoading(false)
    if (error) setError(error.message)
    else setMessage('পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Home Rent Status</h1>
        <p className="sub">Smart Rent & Electricity Tracker</p>

        {error && <div className="login-error">{error}</div>}
        {message && <div style={{ background: '#e6f9f0', color: '#0d8050', padding: 10, borderRadius: 8, marginBottom: 14, fontWeight: 600 }}>{message}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: 13, marginTop: 6 }} disabled={loading}>
              {loading ? 'লগইন হচ্ছে...' : 'Login'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => { setMode('forgot'); setError(''); setMessage('') }}
            >
              Forgot Password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: 13 }} disabled={loading}>
              {loading ? 'পাঠানো হচ্ছে...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => { setMode('login'); setError(''); setMessage('') }}
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
