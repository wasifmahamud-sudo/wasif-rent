import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminShell from './components/AdminShell'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminBills from './pages/admin/Bills'
import AdminTenants from './pages/admin/Tenants'
import AdminReports from './pages/admin/Reports'
import AdminReminders from './pages/admin/Reminders'
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

function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute role="admin">
      <AdminShell>{children}</AdminShell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
          <Route path="/admin/bills" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/admin/tenants" element={<AdminPage><AdminTenants /></AdminPage>} />
          <Route path="/admin/reports" element={<AdminPage><AdminReports /></AdminPage>} />
          <Route path="/admin/reminders" element={<AdminPage><AdminReminders /></AdminPage>} />
          <Route path="/admin/payments" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/admin/rooms" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/admin/settings" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/tenant" element={<ProtectedRoute role="tenant"><TenantDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
