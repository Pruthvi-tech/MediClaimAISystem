import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyClaims } from '../services/api'
import UploadPage from './UploadPage'
import EditClaimModal from '../components/EditClaimModal'
import ClaimReceipt from '../components/ClaimReceipt'

/* ─── Status config ──────────────────────────────────────────────────────── */
const STATUS = {
  pending:      { label: 'Pending',      cls: 'badge-pending',      icon: '', color: '#d97706', bg: '#fef3c7', border: '#fcd34d', step: 0 },
  under_review: { label: 'Under Review', cls: 'badge-under_review', icon: '', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', step: 1 },
  approved:     { label: 'Approved',     cls: 'badge-approved',     icon: '', color: '#16a34a', bg: '#dcfce7', border: '#86efac', step: 2 },
  rejected:     { label: 'Rejected',     cls: 'badge-rejected',     icon: '', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', step: 2 },
}

const POLL_INTERVAL = 30000 // refresh every 30s

/* ─── Main dashboard ─────────────────────────────────────────────────────── */
export default function UserDashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const pollRef          = useRef(null)

  const [claims,    setClaims]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const [filter,    setFilter]    = useState('all')   // 'all' | status key
  const [search,    setSearch]    = useState('')
  const [view,      setView]      = useState('cards') // 'cards' | 'table'
  const [showUpload, setShowUpload] = useState(false)
  const [editClaim,  setEditClaim]  = useState(null)
  const [receiptId,  setReceiptId]  = useState(null)

  /* ── fetch ── */
  const fetchClaims = (quiet = false) => {
    if (!quiet) setLoading(true)
    getMyClaims()
      .then(r => { setClaims(r.data); setLastFetch(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchClaims()
    pollRef.current = setInterval(() => fetchClaims(true), POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  /* ── derived ── */
  const counts = {
    all:          claims.length,
    pending:      claims.filter(c => c.status === 'pending').length,
    under_review: claims.filter(c => c.status === 'under_review').length,
    approved:     claims.filter(c => c.status === 'approved').length,
    rejected:     claims.filter(c => c.status === 'rejected').length,
  }

  const visible = claims.filter(c => {
    const okStatus = filter === 'all' || c.status === filter
    const q = search.toLowerCase()
    const okSearch = !q || [
      c.claim_id, c.extracted_data?.patient_name,
      c.extracted_data?.hospital_name, c.insurance_company,
    ].some(v => v?.toLowerCase().includes(q))
    return okStatus && okSearch
  })

  const hasRejected = claims.some(c => c.status === 'rejected' && c.remarks)

  return (
    <div style={S.page}>
      {/* ── Nav ── */}
      <nav style={S.nav}>
        <div style={S.brand}>
          <span style={S.logo}>+</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>MediClaim</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {lastFetch && (
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Updated {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Link to='/analytics' style={{ fontSize:13, color:'var(--teal)', fontWeight:600, textDecoration:'none' }}> Analytics</Link>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{user?.name}</span>
          <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => { logout(); navigate('/login') }}>Sign out</button>
        </div>
      </nav>

      <div style={S.content}>
        {/* ── Rejection alert banner ── */}
        {hasRejected && (
          <div style={S.rejectAlert}>
             One or more claims were <strong>rejected</strong>. Review the insurer's remarks below and consider re-submitting with corrected documents.
          </div>
        )}

        {/* ── Hero + new claim ── */}
        <div style={S.heroRow}>
          <div>
            <h1 style={S.heroTitle}>My Claims</h1>
            <p style={{ color: 'var(--ink-soft)', marginTop: 4, fontSize: 14 }}>
              Tracking {counts.all} claim{counts.all !== 1 ? 's' : ''}
              {counts.under_review > 0 && ` · ${counts.under_review} under review`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            + New Claim
          </button>
        </div>

        {/* ── Stat pills ── */}
        <div style={S.statRow}>
          {[
            { key: 'all',          label: 'All Claims',   val: counts.all,          color: 'var(--teal)' },
            { key: 'pending',      label: 'Pending',      val: counts.pending,      color: '#d97706' },
            { key: 'under_review', label: 'Under Review', val: counts.under_review, color: '#7c3aed' },
            { key: 'approved',     label: 'Approved',     val: counts.approved,     color: '#16a34a' },
            { key: 'rejected',     label: 'Rejected',     val: counts.rejected,     color: '#dc2626' },
          ].map(s => (
            <button key={s.key} style={{ ...S.statPill, borderColor: filter === s.key ? s.color : 'var(--border)', background: filter === s.key ? s.color + '12' : '#fff' }}
              onClick={() => setFilter(s.key)}>
              <span style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</span>
              <span style={{ fontSize: 12, color: filter === s.key ? s.color : 'var(--ink-soft)', fontWeight: filter === s.key ? 600 : 400 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Toolbar: search + view toggle ── */}
        <div style={S.toolbar}>
          <input className="input" style={{ maxWidth: 320 }}
            placeholder="Search claim ID, patient, hospital…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={S.viewToggle}>
            {[['cards','⊞'],['table','']].map(([v,icon]) => (
              <button key={v} style={{ ...S.vtBtn, ...(view===v ? S.vtBtnActive : {}) }}
                onClick={() => setView(v)}>{icon} {v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
          </div>
          <button style={S.refreshBtn} onClick={() => fetchClaims()} title="Refresh">
            {loading ? <span className="spinner spinner-dark" style={{width:14,height:14}}/> : '↺'}
          </button>
        </div>

        {/* ── Empty state ── */}
        {!loading && visible.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 52, marginBottom: 12 }}></div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
              {claims.length === 0 ? 'No claims yet' : 'No matching claims'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {claims.length === 0
                ? 'Click "+ New Claim" to submit your first medical insurance claim.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        )}

        {/* ── Card view ── */}
        {view === 'cards' && !loading && (
          <div style={S.cardGrid}>
            {visible.map(c => (
              <ClaimCard
                key={c.claim_id}
                claim={c}
                onEdit={() => setEditClaim(c)}
                onReceipt={() => setReceiptId(c.claim_id)}
              />
            ))}
          </div>
        )}

        {/* ── Table view ── */}
        {view === 'table' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Claim History</span>
              {loading && <span className="spinner spinner-dark" style={{width:16,height:16}}/>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--paper)' }}>
                    {['Claim ID','Patient','Hospital','Insurer','Amount','Submitted','Status','Remarks',''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c, i) => {
                    const st = STATUS[c.status] || STATUS.pending
                    const ed = c.extracted_data || {}
                    return (
                      <tr key={c.claim_id} style={{ background: i%2===0?'#fff':'var(--paper)' }}>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:11, color:'var(--teal-dark)', fontWeight:700, whiteSpace:'nowrap' }}>
                          {c.claim_id}
                        </td>
                        <td style={S.td}>{ed.patient_name || '—'}</td>
                        <td style={S.td}>{ed.hospital_name || '—'}</td>
                        <td style={{ ...S.td, maxWidth:140, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.insurance_company}</td>
                        <td style={{ ...S.td, fontWeight:600 }}>{ed.total_amount ? `₹${ed.total_amount}` : '—'}</td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={S.td}>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </td>
                        <td style={{ ...S.td, maxWidth: 200 }}>
                          {c.remarks
                            ? <span style={{ fontSize:12, color: c.status==='rejected'?'var(--red)':'var(--green)', fontStyle:'italic' }}>
                                "{c.remarks.slice(0,60)}{c.remarks.length>60?'…':''}"
                              </span>
                            : <span style={{ color:'var(--ink-faint)', fontSize:12 }}>—</span>
                          }
                        </td>
                        <td style={S.td}>
                          <div style={{ display:'flex', gap:5 }}>
                            <button style={S.actBtn(c.status==='pending')} onClick={() => setEditClaim(c)}>
                              {c.status==='pending' ? ' Edit' : ' View'}
                            </button>
                            <button style={S.actBtnGhost} onClick={() => setReceiptId(c.claim_id)}></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showUpload && <UploadPage onClose={() => { setShowUpload(false); fetchClaims() }} />}
      {editClaim  && <EditClaimModal claim={editClaim} onClose={() => setEditClaim(null)} onSaved={fetchClaims} />}
      {receiptId  && <ClaimReceipt claimId={receiptId} onClose={() => setReceiptId(null)} />}
    </div>
  )
}

/* ─── Claim card ─────────────────────────────────────────────────────────── */
function ClaimCard({ claim, onEdit, onReceipt }) {
  const st = STATUS[claim.status] || STATUS.pending
  const ed = claim.extracted_data || {}
  const isPending  = claim.status === 'pending'
  const isRejected = claim.status === 'rejected'
  const isApproved = claim.status === 'approved'

  return (
    <div style={{ ...S.card, borderTop: `3px solid ${st.color}` }}>
      {/* Card header */}
      <div style={S.cardHead}>
        <code style={{ fontSize: 12, color: 'var(--teal-dark)', fontWeight: 700 }}>{claim.claim_id}</code>
        <span className={`badge ${st.cls}`}>{st.icon} {st.label}</span>
      </div>

      {/* Primary info */}
      <div style={S.cardPatient}>{ed.patient_name || 'Patient not detected'}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
        {ed.hospital_name || '—'} · {ed.diagnosis || '—'}
      </div>

      {/* Key fields */}
      <div style={S.cardFields}>
        <Field label="Amount"    val={ed.total_amount ? `₹${ed.total_amount}` : '—'} bold />
        <Field label="Insurer"   val={claim.insurance_company} />
        <Field label="Admitted"  val={ed.admission_date || '—'} />
        <Field label="Submitted" val={new Date(claim.created_at).toLocaleDateString('en-IN')} />
      </div>

      {/* Status tracker */}
      <StatusTracker status={claim.status} updatedAt={claim.updated_at} />

      {/* Remarks box — most important for rejected claims */}
      {claim.remarks && (
        <div style={{
          ...S.remarksBox,
          background: isRejected ? '#fff1f2' : '#f0fdf4',
          borderColor: isRejected ? '#fca5a5' : '#86efac',
          color: isRejected ? '#991b1b' : '#166534',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4, opacity: .7 }}>
            {isRejected ? ' Rejection Reason' : ' Insurer Note'}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{claim.remarks}</div>
        </div>
      )}

      {/* Actions */}
      <div style={S.cardActions}>
        <button style={S.actBtn(isPending)} onClick={onEdit}>
          {isPending ? ' Edit Claim' : ' View Details'}
        </button>
        <button style={S.actBtnGhost} onClick={onReceipt} title="View receipt"> Receipt</button>
      </div>
    </div>
  )
}

/* ─── Status progress tracker ────────────────────────────────────────────── */
function StatusTracker({ status, updatedAt }) {
  const steps = ['Submitted', 'Under Review', status === 'rejected' ? 'Rejected' : 'Approved']
  const currentStep = STATUS[status]?.step ?? 0
  const isRejected  = status === 'rejected'

  return (
    <div style={S.tracker}>
      {steps.map((label, i) => {
        const done    = i < currentStep
        const current = i === currentStep
        const lastDone= current && (status === 'approved' || status === 'rejected')
        const dotColor = lastDone
          ? (isRejected ? '#dc2626' : '#16a34a')
          : (done || current) ? 'var(--teal)' : '#e2e8f0'

        return (
          <div key={label} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 0 }}>
            <div style={{ textAlign:'center', minWidth: 60 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: dotColor, margin: '0 auto 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#fff', fontWeight: 700,
              }}>
                {(done || lastDone) ? '' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: (done||current) ? 'var(--ink)' : 'var(--ink-faint)', fontWeight: current ? 600 : 400, lineHeight: 1.3 }}>
                {label}
              </div>
              {current && updatedAt && (
                <div style={{ fontSize: 9, color: 'var(--ink-faint)', marginTop: 2 }}>
                  {new Date(updatedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? 'var(--teal)' : '#e2e8f0', margin: '0 2px 14px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Tiny helpers ───────────────────────────────────────────────────────── */
function Field({ label, val, bold }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: bold ? 'var(--teal-dark)' : 'var(--ink)' }}>{val}</div>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const S = {
  page:  { minHeight: '100vh', background: 'var(--paper)' },
  nav: {
    background: '#fff', borderBottom: '1px solid var(--border)',
    padding: '0 28px', height: 58,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand:   { display:'flex', alignItems:'center', gap:10 },
  logo: {
    width:32, height:32, background:'var(--teal)', color:'#fff',
    borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:18, fontWeight:700,
  },
  content: { maxWidth: 1160, margin: '0 auto', padding: '28px 24px' },
  rejectAlert: {
    background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 10,
    padding: '12px 18px', fontSize: 14, color: '#991b1b',
    marginBottom: 20, lineHeight: 1.6,
  },
  heroRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  heroTitle: { fontFamily:'var(--font-display)', fontSize:28, fontWeight:400 },
  statRow: { display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' },
  statPill: {
    display:'flex', flexDirection:'column', alignItems:'center',
    gap:2, padding:'12px 18px', borderRadius:10,
    border:'1.5px solid', cursor:'pointer', transition:'all .15s',
    minWidth:90, background:'#fff',
  },
  toolbar: { display:'flex', gap:10, alignItems:'center', marginBottom:20, flexWrap:'wrap' },
  viewToggle: { display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' },
  vtBtn: { padding:'7px 14px', border:'none', background:'none', cursor:'pointer', fontSize:13, color:'var(--ink-soft)', fontFamily:'var(--font-body)', transition:'all .12s' },
  vtBtnActive: { background:'var(--teal)', color:'#fff' },
  refreshBtn: {
    width:36, height:36, border:'1px solid var(--border)', borderRadius:8,
    background:'#fff', cursor:'pointer', fontSize:16, color:'var(--ink-soft)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  empty: { textAlign:'center', padding:'64px 24px', color:'var(--ink)' },
  cardGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:18 },
  card: {
    background:'#fff', border:'1px solid var(--border)', borderRadius:12,
    padding:20, boxShadow:'var(--shadow)', display:'flex', flexDirection:'column', gap:0,
  },
  cardHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  cardPatient: { fontSize:17, fontWeight:700, color:'var(--ink)', marginBottom:4, lineHeight:1.3 },
  cardFields: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 16px', marginBottom:14, padding:'12px', background:'var(--paper)', borderRadius:8 },
  tracker: { display:'flex', alignItems:'flex-start', marginBottom:14, padding:'10px 4px 0' },
  remarksBox: {
    border:'1px solid', borderRadius:8, padding:'10px 12px', marginBottom:14,
  },
  cardActions: { display:'flex', gap:8, marginTop:'auto' },
  actBtn: (isPrimary) => ({
    flex:1, padding:'8px 12px', borderRadius:7, border:'none',
    background: isPrimary ? 'var(--teal)' : 'var(--paper)',
    color: isPrimary ? '#fff' : 'var(--ink-soft)',
    border: isPrimary ? 'none' : '1px solid var(--border)',
    fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)',
    transition:'all .15s',
  }),
  actBtnGhost: {
    padding:'8px 12px', borderRadius:7, border:'1px solid var(--border)',
    background:'var(--paper)', color:'var(--ink-soft)',
    fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)',
    whiteSpace:'nowrap',
  },
  th: { padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--ink-soft)', letterSpacing:.4, textTransform:'uppercase', whiteSpace:'nowrap' },
  td: { padding:'11px 14px', fontSize:13, borderTop:'1px solid var(--border)' },
}