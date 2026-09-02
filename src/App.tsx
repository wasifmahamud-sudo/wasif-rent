import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminBills from './pages/admin/Bills'
import AdminTenants from './pages/admin/Tenants'
import TenantDashboard from './pages/tenant/Dashboard'

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <div>লোড হচ্ছে...</div>
      </div>
    )
  }
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/tenant'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/bills" element={<ProtectedRoute role="admin"><AdminBills /></ProtectedRoute>} />
          <Route path="/admin/tenants" element={<ProtectedRoute role="admin"><AdminTenants /></ProtectedRoute>} />
          <Route path="/admin/payments" element={<ProtectedRoute role="admin"><AdminBills /></ProtectedRoute>} />
          <Route path="/admin/rooms" element={<ProtectedRoute role="admin"><AdminBills /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminBills /></ProtectedRoute>} />

          <Route path="/tenant" element={<ProtectedRoute role="tenant"><TenantDashboard /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
