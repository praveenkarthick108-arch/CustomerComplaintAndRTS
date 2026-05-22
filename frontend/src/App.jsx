import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ComplaintList from './pages/complaints/ComplaintList'
import CreateComplaint from './pages/complaints/CreateComplaint'
import ComplaintDetail from './pages/complaints/ComplaintDetail'
import AgentWorkQueue from './pages/AgentWorkQueue'
import EscalationDashboard from './pages/EscalationDashboard'
import Reports from './pages/Reports'
import UserManagement from './pages/admin/UserManagement'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import LoadingSpinner from './components/common/LoadingSpinner'
import Analytics from './pages/Analytics'

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <LoadingSpinner message="Loading..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner message="Loading..." />
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="complaints" element={<ComplaintList />} />
        <Route
          path="complaints/new"
          element={<CreateComplaint />}
        />
        <Route path="complaints/:id" element={<ComplaintDetail />} />
        <Route path="work-queue" element={<AgentWorkQueue />} />
        <Route
          path="escalations"
          element={
            <ProtectedRoute roles={['admin', 'supervisor']}>
              <EscalationDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'quality']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'quality']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '8px', fontSize: '14px' }
            }}
          />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
