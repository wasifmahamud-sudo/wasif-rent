
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminShell from './components/AdminShell'
import TenantShell from './components/TenantShell'

import Login from './pages/Login'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminBills from './pages/admin/Bills'
import AdminTenants from './pages/admin/Tenants'
import AdminReports from './pages/admin/Reports'
import AdminReminders from './pages/admin/Reminders'
import AdminNotices from './pages/admin/Notices'
import AdminComplaints from './pages/admin/Complaints'
import PaymentReceipts from './pages/admin/PaymentReceipts'

// Tenant Pages
import TenantDashboard from './pages/tenant/Dashboard'
import TenantBills from './pages/tenant/Bills'
import TenantElectricityUsage from './pages/tenant/ElectricityUsage'
import TenantPayments from './pages/tenant/Payments'
import TenantPaymentReceipts from './pages/tenant/PaymentReceipts'
import TenantProfile from './pages/tenant/Profile'
import TenantNotices from './pages/tenant/Notices'
import TenantComplaints from './pages/tenant/Complaints'

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

  return (
    <Navigate
      to={profile.role === 'admin' ? '/admin' : '/tenant'}
      replace
    />
  )
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

          {/* Admin Routes - Existing routes preserved */}
          <Route path="/admin" element={<AdminPage><AdminDashboard /></AdminPage>} />
          <Route path="/admin/bills" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/admin/tenants" element={<AdminPage><AdminTenants /></AdminPage>} />
          <Route path="/admin/reports" element={<AdminPage><AdminReports /></AdminPage>} />
          <Route path="/admin/reminders" element={<AdminPage><AdminReminders /></AdminPage>} />
          <Route path="/admin/notices" element={<AdminPage><AdminNotices /></AdminPage>} />
          <Route path="/admin/complaints" element={<AdminPage><AdminComplaints /></AdminPage>} />
          <Route path="/admin/payments" element={<AdminPage><PaymentReceipts /></AdminPage>} />
          <Route path="/admin/rooms" element={<AdminPage><AdminBills /></AdminPage>} />
          <Route path="/admin/settings" element={<AdminPage><AdminBills /></AdminPage>} />

          {/* Tenant Routes - Shared Sidebar */}
          <Route
            path="/tenant"
            element={
              <ProtectedRoute role="tenant">
                <TenantShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<TenantDashboard />} />
            <Route path="bills" element={<TenantBills />} />
            <Route path="electricity" element={<TenantElectricityUsage />} />
            <Route path="payments" element={<TenantPayments />} />
            <Route path="receipts" element={<TenantPaymentReceipts />} />
            <Route path="profile" element={<TenantProfile />} />
            <Route path="notices" element={<TenantNotices />} />
            <Route path="complaints" element={<TenantComplaints />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
