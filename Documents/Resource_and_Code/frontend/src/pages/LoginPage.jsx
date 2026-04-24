import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendOTP, verifyOTP } from '../services/api'

const OTP_LENGTH    = 6
const OTP_EXPIRY    = 300
const RESEND_COOLDOWN = 60

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, login } = useAuth()

  const [step,         setStep]         = useState('email')
  const [role,         setRole]         = useState('user')
  const [email,        setEmail]        = useState('')
  const [otp,          setOtp]          = useState(Array(OTP_LENGTH).fill(''))
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [info,         setInfo]         = useState('')
  const [expiryLeft,   setExpiryLeft]   = useState(OTP_EXPIRY)
  const [resendLeft,   setResendLeft]   = useState(RESEND_COOLDOWN)
  const [attemptsLeft, setAttemptsLeft] = useState(5)

  const expiryRef = useRef(null)
  const resendRef = useRef(null)
  const inputRefs = useRef([])

  useEffect(() => { if (user) navigate('/') }, [user])

  useEffect(() => {
    if (step !== 'otp') return
    expiryRef.current = setInterval(() => {
      setExpiryLeft(p => {
        if (p <= 1) { clearInterval(expiryRef.current); setError('Code expired. Please request a new one.'); return 0 }
        return p - 1
      })
    }, 1000)
    resendRef.current = setInterval(() => {
      setResendLeft(p => { if (p <= 1) { clearInterval(resendRef.current); return 0 } return p - 1 })
    }, 1000)
    return () => { clearInterval(expiryRef.current); clearInterval(resendRef.current) }
  }, [step])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Please enter your email address.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Invalid email format.')
    setLoading(true)
    try {
      await sendOTP(email.trim().toLowerCase())
      setStep('otp'); setExpiryLeft(OTP_EXPIRY); setResendLeft(RESEND_COOLDOWN)
      setOtp(Array(OTP_LENGTH).fill(''))
      setAttemptsLeft(5); setInfo('')
      setTimeout(() => inputRefs.current[0]?.focus(), 120)
    } catch (err) {
      let msg = 'Failed to send code. Try again.'
      if (err.response?.data?.detail) msg = err.response.data.detail
      else if (err.code === 'ERR_NETWORK' || !err.response) msg = 'Cannot reach server. Is the backend running on port 8000?'
      else if (err.response?.status === 500) msg = 'Server error. Check that MongoDB is running.'
      setError(msg)
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (resendLeft > 0 || loading) return
    setError(''); setLoading(true)
    try {
      await sendOTP(email)
      setExpiryLeft(OTP_EXPIRY); setResendLeft(RESEND_COOLDOWN)
      setOtp(Array(OTP_LENGTH).fill(''))
      setAttemptsLeft(5); setInfo('New code sent!')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend.')
    } finally { setLoading(false) }
  }

  const handleOtpChange = (i, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = digit; setOtp(next); setError(''); setInfo('')
    if (digit && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
    if (next.every(d => d !== '')) verifyWithOtp(next.join(''))
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft'  && i > 0)            inputRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (pasted.length === OTP_LENGTH) { setOtp(pasted.split('')); verifyWithOtp(pasted) }
  }

  const verifyWithOtp = async (code) => {
    if (expiryLeft <= 0) { setError('Code expired. Request a new one.'); return }
    setLoading(true); setError('')
    try {
      const res = await verifyOTP(email, code, role)
      login(res.data.access_token, res.data.user)
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      let msg = detail || 'Verification failed.'
      if (err.response?.status === 403) msg = detail
      setError(msg)
      const match = msg.match(/(\d+) attempt/)
      if (match) setAttemptsLeft(parseInt(match[1]))
      setOtp(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const handleVerify = (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return }
    verifyWithOtp(code)
  }

  const expired = expiryLeft <= 0
  const pct     = (expiryLeft / OTP_EXPIRY) * 100

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box }
      `}</style>

      <div style={S.left}>
        <div style={S.leftBg} />
        <div style={S.leftContent}>
          <div style={S.logo}>
            <div style={S.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L12 22M2 12L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={S.logoText}>MediClaim</span>
          </div>

          <div style={S.headline}>
            <div style={S.tag}>AI-Powered Claims Platform</div>
            <h1 style={S.h1}>
              Healthcare claims,{' '}
              <span style={{ color: '#34d399' }}>without the hassle.</span>
            </h1>
            <p style={S.sub}>
              Upload your medical documents. Our AI reads, extracts, and routes your claim automatically in seconds.
            </p>
          </div>

          <div style={S.features}>
            {[
              ['OCR Extraction', 'Reads any PDF or image instantly'],
              ['Smart Routing', 'Sent to the right insurer automatically'],
              ['Live Tracking', 'Real-time status updates always'],
            ].map(([t, d]) => (
              <div key={t} style={S.feature}>
                <div style={S.dot} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{t}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.4 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={S.stats}>
            {[['10s', 'Avg extraction'],['5', 'Insurer networks'],['100%', 'Encrypted']].map(([v, l]) => (
              <div key={l} style={{ flex: 1 }}>
                <div style={S.statNum}>{v}</div>
                <div style={S.statLabel}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.right}>
        <div style={S.card}>

          <div style={S.tabs}>
            {[['user', 'Patient'],['insurer', 'Provider']].map(([r, label]) => (
              <button key={r}
                style={{ ...S.tab, ...(role === r ? S.tabOn : {}) }}
                onClick={() => { setRole(r); setError(''); setInfo(''); if (step === 'otp') setStep('email') }}>
                {label}
              </button>
            ))}
          </div>

          {step === 'email' && (
            <div key="email" style={{ animation: 'fadeUp .3s ease' }}>
              <h2 style={S.title}>{role === 'user' ? 'Welcome back' : 'Provider portal'}</h2>
              <p style={S.titleSub}>
                {role === 'user'
                  ? 'Enter your email to receive a secure sign-in code.'
                  : 'Enter your registered provider email address.'}
              </p>

              {role === 'insurer' && (
                <div style={S.notice}>
                  Provider accounts must be pre-registered by your admin.
                </div>
              )}

              <form onSubmit={handleSendOTP} style={{ marginTop: 20 }}>
                <label style={S.label}>Email address</label>
                <input
                  style={{ ...S.input, ...(error ? S.inputErr : {}) }}
                  type="email" placeholder="you@example.com"
                  value={email} autoFocus
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  disabled={loading}
                />
                {error && <Err msg={error} />}
                <button style={{ ...S.btn, ...(loading ? { opacity: .8 } : {}) }} type="submit" disabled={loading}>
                  {loading ? <><Spin /> Sending…</> : 'Send verification code'}
                </button>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <div key="otp" style={{ animation: 'fadeUp .3s ease' }}>
              <button style={S.back} onClick={() => { setStep('email'); setError(''); setInfo('') }}>
                Back
              </button>

              <h2 style={S.title}>Check your email</h2>
              <p style={S.titleSub}>
                We sent a 6-digit code to 
                <strong style={{ color: '#0d1117' }}>{email}</strong>
              </p>

              <div style={S.timerWrap}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: expired ? '#dc2626' : pct > 30 ? '#059669' : '#d97706' }}>
                    {expired ? 'Code expired' : `Expires in ${fmt(expiryLeft)}`}
                  </span>
                  {!expired && attemptsLeft < 5 && (
                    <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{attemptsLeft} attempts left</span>
                  )}
                </div>
                <div style={S.timerTrack}>
                  <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`,
                    background: pct > 50 ? '#059669' : pct > 20 ? '#d97706' : '#dc2626',
                    transition: 'width 1s linear, background .3s' }} />
                </div>
              </div>

              <form onSubmit={handleVerify}>
                <div style={S.otpRow} onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i} ref={el => inputRefs.current[i] = el}
                      style={{ ...S.otpBox,
                        borderColor: error ? '#fca5a5' : digit ? '#0d9488' : '#e2e8f0',
                        background:  error ? '#fff5f5' : digit ? '#f0fdfb' : '#fafbfc',
                        color: digit ? '#0f766e' : '#374151',
                        transform: digit ? 'scale(1.04)' : 'scale(1)',
                      }}
                      type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      disabled={loading || expired} />
                  ))}
                </div>

                {error && <Err msg={error} />}
                {info && !error && <div style={S.infoBox}>{info}</div>}

                <button style={{ ...S.btn, ...(loading || expired || otp.join('').length < 6 ? S.btnOff : {}) }}
                  type="submit" disabled={loading || expired || otp.join('').length < 6}>
                  {loading ? <><Spin /> Verifying…</> : 'Verify and sign in'}
                </button>
              </form>

              <div style={S.resendRow}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>Didn't receive it?</span>
                {resendLeft > 0
                  ? <span style={{ fontSize: 13, color: '#d1d5db' }}>Resend in {resendLeft}s</span>
                  : <button style={S.resendBtn} onClick={handleResend} disabled={loading}>Resend code</button>}
              </div>
            </div>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: '#cbd5e1', textAlign: 'center' }}>
          Secured with end-to-end encryption · MediClaim 2026
        </p>
      </div>
    </div>
  )
}

function Spin() {
  return <span style={{ display:'inline-block', width:16, height:16,
    border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff',
    borderRadius:'50%', animation:'spin .65s linear infinite' }} />
}

function Err({ msg }) {
  return (
    <div style={{ background:'#fff5f5', border:'1px solid #fca5a5', borderRadius:8,
      padding:'10px 12px', margin:'12px 0', fontSize:13, color:'#dc2626', lineHeight:1.5 }}>
      {msg}
    </div>
  )
}

const S = {
  page: { display:'flex', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif" },
  left: { flex:'0 0 44%', position:'relative', background:'#020c14', display:'flex', overflow:'hidden' },
  leftBg: { position:'absolute', inset:0,
    background:'radial-gradient(ellipse 80% 60% at 20% 80%, rgba(13,148,136,.22) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(16,185,129,.1) 0%, transparent 50%)' },
  leftContent: { position:'relative', zIndex:2, padding:'44px 52px',
    display:'flex', flexDirection:'column', justifyContent:'space-between', width:'100%' },
  logo: { display:'flex', alignItems:'center', gap:12 },
  logoIcon: { width:38, height:38, background:'linear-gradient(135deg,#0d9488,#059669)',
    borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 0 0 1px rgba(255,255,255,.1),0 4px 12px rgba(13,148,136,.4)' },
  logoText: { fontSize:20, fontWeight:700, color:'#fff', letterSpacing:'-.4px' },
  headline: { flex:1, display:'flex', flexDirection:'column', justifyContent:'center' },
  tag: { display:'inline-block', alignSelf:'flex-start',
    background:'rgba(52,211,153,.1)', border:'1px solid rgba(52,211,153,.25)',
    color:'#34d399', fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:'uppercase',
    padding:'5px 12px', borderRadius:99, marginBottom:22 },
  h1: { margin:'0 0 18px', fontSize:44, fontWeight:700, color:'#fff',
    lineHeight:1.2, letterSpacing:'-1px', whiteSpace:'pre-line' },
  sub: { margin:0, fontSize:15, lineHeight:1.75, color:'rgba(255,255,255,.45)', maxWidth:360 },
  features: { display:'flex', flexDirection:'column', gap:16, marginTop:40 },
  feature: { display:'flex', alignItems:'flex-start', gap:14 },
  dot: { width:8, height:8, borderRadius:'50%', background:'#34d399',
    flexShrink:0, marginTop:4, boxShadow:'0 0 8px rgba(52,211,153,.6)' },
  stats: { display:'flex', borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:28 },
  statNum: { fontSize:26, fontWeight:800, color:'#34d399', lineHeight:1, letterSpacing:'-1px' },
  statLabel: { fontSize:11, color:'rgba(255,255,255,.35)', marginTop:4 },
  right: { flex:1, display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center', padding:'40px 24px', background:'#f8fafc' },
  card: { width:'100%', maxWidth:400, background:'#fff',
    border:'1px solid #e8edf2', borderRadius:20,
    boxShadow:'0 2px 4px rgba(0,0,0,.03),0 12px 40px rgba(0,0,0,.07)',
    padding:'32px 32px 28px' },
  tabs: { display:'flex', background:'#f1f5f9', borderRadius:10, padding:4, marginBottom:28 },
  tab: { flex:1, padding:'9px 0', border:'none', background:'transparent',
    borderRadius:7, cursor:'pointer', fontSize:13.5, fontWeight:600, color:'#94a3b8',
    fontFamily:'inherit', transition:'all .18s' },
  tabOn: { background:'#fff', color:'#0d1117',
    boxShadow:'0 1px 3px rgba(0,0,0,.08),0 1px 1px rgba(0,0,0,.04)' },
  title: { margin:'0 0 6px', fontSize:24, fontWeight:700, color:'#0d1117',
    letterSpacing:'-.5px', fontFamily:'inherit' },
  titleSub: { margin:'0 0 4px', fontSize:14, color:'#6b7280', lineHeight:1.6, whiteSpace:'pre-line' },
  notice: { background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8,
    padding:'10px 13px', fontSize:13, color:'#92400e', marginTop:12, lineHeight:1.5 },
  label: { display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:7, marginTop:20 },
  input: { width:'100%', padding:'12px 14px', border:'1.5px solid #e2e8f0',
    borderRadius:10, fontSize:14.5, color:'#0d1117', background:'#fff',
    fontFamily:'inherit', outline:'none', boxSizing:'border-box',
    transition:'border-color .15s' },
  inputErr: { borderColor:'#fca5a5', background:'#fff9f9' },
  btn: { width:'100%', padding:'13px',
    background:'linear-gradient(135deg,#0d9488 0%,#0f766e 100%)',
    color:'#fff', border:'none', borderRadius:10,
    fontSize:14.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
    boxShadow:'0 4px 12px rgba(13,148,136,.3)',
    transition:'opacity .15s', marginTop:16 },
  btnOff: { opacity:.4, cursor:'not-allowed', boxShadow:'none' },
  back: { background:'none', border:'none', padding:'0 0 20px',
    fontSize:13, fontWeight:600, color:'#6b7280', cursor:'pointer', fontFamily:'inherit', display:'block' },
  timerWrap: { marginBottom:20, marginTop:20 },
  timerTrack: { height:4, background:'#e2e8f0', borderRadius:99, overflow:'hidden' },
  otpRow: { display:'flex', gap:8, marginBottom:4 },
  otpBox: { flex:1, aspectRatio:'1', minWidth:0, textAlign:'center',
    fontSize:22, fontWeight:700, border:'1.5px solid', borderRadius:12,
    outline:'none', cursor:'text', fontFamily:'inherit', transition:'all .15s' },
  infoBox: { background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8,
    padding:'10px 12px', margin:'12px 0', fontSize:13, color:'#166534' },
  resendRow: { display:'flex', justifyContent:'space-between', alignItems:'center',
    marginTop:18, paddingTop:16, borderTop:'1px solid #f1f5f9' },
  resendBtn: { background:'none', border:'none', color:'#0d9488',
    fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:0 },
}