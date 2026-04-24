import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import UserDashboard from './pages/UserDashboard'
import InsurerDashboard from './pages/InsurerDashboard'
import AnalyticsPage from './pages/AnalyticsPage'
import NotFound from './pages/NotFound'

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', justifyContent:'center', marginTop:80 }}><span className="spinner spinner-dark" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function RoleRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'insurer') return <Navigate to="/insurer" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard" element={
            <PrivateRoute><UserDashboard /></PrivateRoute>
          } />
          <Route path="/analytics" element={
            <PrivateRoute><AnalyticsPage /></PrivateRoute>
          } />
          <Route path="/insurer" element={
            <PrivateRoute role="insurer"><InsurerDashboard /></PrivateRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}