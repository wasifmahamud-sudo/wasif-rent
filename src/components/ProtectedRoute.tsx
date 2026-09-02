import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  role?: 'admin' | 'tenant'
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (role && profile.role !== role) {
    // Wrong role → send to their correct dashboard
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/tenant'} replace />
  }

  return <>{children}</>
}
