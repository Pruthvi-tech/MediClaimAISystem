import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <div style={{ minHeight:'100vh', background:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)' }}>
      <div style={{ textAlign:'center', padding:32 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:96, color:'var(--teal)', lineHeight:1 }}>404</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:400, margin:'16px 0 8px' }}>Page not found</h2>
        <p style={{ color:'var(--ink-soft)', marginBottom:28 }}>The page you're looking for doesn't exist.</p>
        <button className="btn btn-primary" onClick={() => navigate(user ? '/' : '/login')}>
          ← Go back home
        </button>
      </div>
    </div>
  )
}