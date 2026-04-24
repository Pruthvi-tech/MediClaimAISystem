import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getInsurerClaims, reviewClaim, startReview } from '../services/api'

/* ── Status config with dot colours ──────────────────────────────────────── */
const STATUS = {
  pending:      { label: 'Pending',      cls: 'badge-pending',      dot: '#d97706' },
  under_review: { label: 'Under Review', cls: 'badge-under_review', dot: '#7c3aed' },
  approved:     { label: 'Approved',     cls: 'badge-approved',     dot: '#16a34a' },
  rejected:     { label: 'Rejected',     cls: 'badge-rejected',     dot: '#dc2626' },
}

const FIELDS = {
  patient_name:'Patient', hospital_name:'Hospital',
  admission_date:'Admitted', discharge_date:'Discharged',
  total_amount:'Amount (Rs)', diagnosis:'Diagnosis',
  doctor_name:'Doctor', policy_number:'Policy No.',
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function InsurerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [claims,    setClaims]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  // selected holds a full claim object; we keep it in sync with the claims array
  const [selectedId, setSelectedId] = useState(null)
  const [reviewing,  setReviewing]  = useState(null)
  const [docView,    setDocView]    = useState(null)

  /* derive selected from claims array so it always reflects latest status */
  const selected = claims.find(c => c.claim_id === selectedId) || null

  const fetchClaims = useCallback((quiet = false) => {
    if (!quiet) setLoading(true)
    getInsurerClaims()
      .then(r => setClaims(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchClaims() }, [fetchClaims])

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
      c.claim_id, c.user_name, c.user_email,
      c.extracted_data?.patient_name, c.extracted_data?.hospital_name,
    ].some(v => v?.toLowerCase().includes(q))
    return okStatus && okSearch
  })

  /* optimistically update claim in list, then refetch for truth */
  const patchLocal = (claim_id, patch) => {
    setClaims(prev => prev.map(c => c.claim_id === claim_id ? { ...c, ...patch } : c))
  }

  const handleStartReview = async () => {
    if (!selected) return
    try {
      patchLocal(selected.claim_id, { status: 'under_review' })
      await startReview(selected.claim_id)
      fetchClaims(true)
    } catch (e) {
      fetchClaims()   // revert on failure
      alert(e.response?.data?.detail || 'Failed to start review')
    }
  }

  const handleReviewDone = (claim_id, status, remarks) => {
    patchLocal(claim_id, { status, remarks })
    setReviewing(null)
    fetchClaims(true)   // background sync with server
  }

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.brand}>
          <span style={S.logo}>+</span>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'#fff', lineHeight:1.2 }}>MediClaim</div>
            <div style={{ fontSize:11, color:'#5eead4', letterSpacing:.3 }}>Insurance Portal</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{user?.name}</div>
            <div style={{ fontSize:11, color:'#94a3b8' }}>{user?.company_name}</div>
          </div>
          <Link to="/analytics" style={{ fontSize:13, color:'#5eead4', fontWeight:600, textDecoration:'none' }}>Analytics</Link>
          <button className="btn" style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', padding:'7px 16px' }}
            onClick={() => { logout(); navigate('/login') }}>Sign out</button>
        </div>
      </nav>

      <div style={S.layout}>
        {/* ── LEFT: claim queue ── */}
        <div style={S.sidebar}>
          {/* stat chips */}
          <div style={S.statsRow}>
            {[['all','Total',counts.all],['pending','Pending',counts.pending],
              ['under_review','Reviewing',counts.under_review],['approved','Approved',counts.approved]].map(([k,l,v]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ ...S.statCard, borderColor: filter===k ? 'var(--teal)' : 'var(--border)' }}>
                <div style={{ fontSize:20, fontWeight:700, color:'var(--teal)' }}>{v}</div>
                <div style={{ fontSize:11, color:'var(--ink-soft)' }}>{l}</div>
              </button>
            ))}
          </div>

          <input className="input" placeholder="Search ID, patient, hospital…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:10 }} />

          {/* filter tabs */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
            {['all','pending','under_review','approved','rejected'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ ...S.ftab, ...(filter===s ? S.ftabActive : {}) }}>
                {/* status dot */}
                {s !== 'all' && (
                  <span style={{ width:6, height:6, borderRadius:'50%',
                    background: filter===s ? '#fff' : STATUS[s]?.dot,
                    display:'inline-block', flexShrink:0 }} />
                )}
                {s === 'all' ? 'All' : STATUS[s]?.label}
                {counts[s] > 0 && (
                  <span style={{ ...S.bubble, background: filter===s ? 'rgba(255,255,255,.3)' : 'var(--teal)', color:'#fff' }}>
                    {counts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* list */}
          <div style={S.claimList}>
            {loading && <div style={{ textAlign:'center', padding:40 }}><span className="spinner spinner-dark" /></div>}
            {!loading && visible.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--ink-faint)', fontSize:13 }}>No claims found.</div>
            )}
            {visible.map(c => (
              <ClaimRow key={c.claim_id} claim={c}
                isActive={selectedId === c.claim_id}
                onClick={() => setSelectedId(c.claim_id)} />
            ))}
          </div>
        </div>

        {/* ── RIGHT: detail ── */}
        <div style={S.detail}>
          {!selected ? (
            <EmptyDetail />
          ) : (
            <ClaimDetail
              claim={selected}
              onStartReview={handleStartReview}
              onReview={() => setReviewing(selected)}
              onViewDoc={() => setDocView(selected)}
            />
          )}
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          claim={reviewing}
          onClose={() => setReviewing(null)}
          onDone={handleReviewDone}
        />
      )}
      {docView && <DocViewer claim={docView} onClose={() => setDocView(null)} />}
    </div>
  )
}

/* ── Claim row in list ───────────────────────────────────────────────────── */
function ClaimRow({ claim, isActive, onClick }) {
  const st = STATUS[claim.status] || STATUS.pending
  const ed = claim.extracted_data || {}
  return (
    <div style={{ ...S.row, ...(isActive ? S.rowActive : {}) }} onClick={onClick}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <code style={{ fontSize:11, color:'var(--teal-dark)', fontWeight:700 }}>{claim.claim_id}</code>
        <StatusBadge status={claim.status} />
      </div>
      <div style={{ fontSize:14, fontWeight:600, marginBottom:2, color:'var(--ink)' }}>
        {ed.patient_name || claim.user_name || '—'}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--ink-soft)' }}>
        <span>{ed.hospital_name || '—'}</span>
        {ed.total_amount && <span style={{ color:'var(--teal-dark)', fontWeight:600 }}>Rs.{ed.total_amount}</span>}
      </div>
      <div style={{ fontSize:11, color:'var(--ink-faint)', marginTop:4 }}>
        {new Date(claim.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
        {' · '}{claim.user_email}
      </div>
    </div>
  )
}

/* ── Status badge with dot ───────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const st = STATUS[status] || STATUS.pending
  return (
    <span className={`badge ${st.cls}`} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:st.dot, display:'inline-block' }} />
      {st.label}
    </span>
  )
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyDetail() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'100%', gap:12, color:'var(--ink-faint)' }}>
      <div style={{ fontSize:52, opacity:.4 }}>[ ]</div>
      <p style={{ fontWeight:600, color:'var(--ink-soft)' }}>Select a claim to review</p>
      <p style={{ fontSize:13 }}>Click any claim from the list on the left.</p>
    </div>
  )
}

/* ── Claim detail panel ──────────────────────────────────────────────────── */
function ClaimDetail({ claim, onStartReview, onReview, onViewDoc }) {
  const ed = claim.extracted_data || {}
  const canStart  = claim.status === 'pending'
  const canReview = ['pending', 'under_review'].includes(claim.status)
  const isDone    = ['approved', 'rejected'].includes(claim.status)

  return (
    <div style={{ overflowY:'auto', padding:'24px 28px', flex:1 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--border)',
        flexWrap:'wrap', gap:12 }}>
        <div>
          <code style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color:'var(--teal-dark)' }}>
            {claim.claim_id}
          </code>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
            <StatusBadge status={claim.status} />
            <span style={{ fontSize:12, color:'var(--ink-faint)' }}>
              Submitted {new Date(claim.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {claim.document_path && (
            <button className="btn btn-ghost" style={{ padding:'7px 14px', fontSize:13 }} onClick={onViewDoc}>
              View Document
            </button>
          )}
          {canStart && (
            <button className="btn btn-ghost" style={{ padding:'7px 14px', fontSize:13, borderColor:'#7c3aed', color:'#7c3aed' }}
              onClick={onStartReview}>
              Mark Under Review
            </button>
          )}
          {canReview && (
            <button className="btn btn-primary" style={{ padding:'7px 18px', fontSize:13 }} onClick={onReview}>
              Approve / Reject
            </button>
          )}
        </div>
      </div>

      {/* Done banner */}
      {isDone && (
        <div style={{
          background: claim.status === 'approved' ? 'var(--green-light)' : 'var(--red-light)',
          border: `1px solid ${claim.status === 'approved' ? '#86efac' : '#fca5a5'}`,
          borderRadius:8, padding:'12px 16px', marginBottom:24,
          fontSize:14, color: claim.status === 'approved' ? '#166534' : '#991b1b',
          fontWeight:600,
        }}>
          {claim.status === 'approved' ? 'This claim has been approved.' : 'This claim has been rejected.'}
          {claim.remarks && <div style={{ fontWeight:400, marginTop:4 }}>Remarks: {claim.remarks}</div>}
        </div>
      )}

      {/* Claimant info */}
      <Label>Claimant</Label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12,
        background:'var(--paper)', borderRadius:8, padding:'12px 16px',
        border:'1px solid var(--border)', marginBottom:20 }}>
        {[['Submitted By', claim.user_name], ['Email', claim.user_email],
          ['Last Updated', new Date(claim.updated_at).toLocaleDateString('en-IN')]].map(([l,v]) => (
          <div key={l}>
            <div style={{ fontSize:10, color:'var(--ink-faint)', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-all' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Medical fields */}
      <Label>Medical Details</Label>
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
        {Object.entries(FIELDS).map(([k, label]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between',
            padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, color:'var(--ink-soft)', fontWeight:500 }}>{label}</span>
            <span style={{ fontSize:13, fontWeight:600, textAlign:'right', maxWidth:'55%',
              color: ed[k] ? 'var(--ink)' : 'var(--ink-faint)',
              fontStyle: ed[k] ? 'normal' : 'italic' }}>
              {ed[k] || 'Not provided'}
            </span>
          </div>
        ))}
      </div>

      {/* Notes */}
      {claim.notes && (
        <>
          <Label>Patient Notes</Label>
          <p style={{ fontSize:14, color:'var(--ink-soft)', lineHeight:1.7, marginBottom:20 }}>{claim.notes}</p>
        </>
      )}
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase',
      letterSpacing:.5, color:'var(--ink-soft)', marginBottom:10 }}>
      {children}
    </div>
  )
}

/* ── Review modal ────────────────────────────────────────────────────────── */
function ReviewModal({ claim, onClose, onDone }) {
  const [decision, setDecision] = useState('')
  const [remarks,  setRemarks]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const ed = claim.extracted_data || {}

  const handleSubmit = async () => {
    if (!decision) { setError('Please select Approve or Reject.'); return }
    if (decision === 'rejected' && !remarks.trim()) {
      setError('Remarks are required when rejecting a claim.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await reviewClaim(claim.claim_id, { status: decision, remarks: remarks.trim() || null })
      onDone(claim.claim_id, decision, remarks.trim() || null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={S.overlay}>
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 24px 80px rgba(0,0,0,.22)',
        width:'100%', maxWidth:500, display:'flex', flexDirection:'column',
        maxHeight:'90vh', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:400, marginBottom:4 }}>
              Review Decision
            </h3>
            <StatusBadge status={claim.status} />
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', fontSize:20, color:'var(--ink-faint)', cursor:'pointer' }}>
            x
          </button>
        </div>

        <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
          {/* Claim summary */}
          <div style={{ background:'var(--paper)', border:'1px solid var(--border)',
            borderRadius:10, padding:'4px 14px', marginBottom:20 }}>
            {[['Claim ID', claim.claim_id], ['Patient', ed.patient_name],
              ['Hospital', ed.hospital_name],
              ['Amount', ed.total_amount ? `Rs. ${ed.total_amount}` : null],
              ['Diagnosis', ed.diagnosis]].map(([l, v]) => v ? (
              <div key={l} style={{ display:'flex', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--ink-soft)' }}>{l}</span>
                <span style={{ fontSize:13, fontWeight: l==='Amount'?700:600, fontFamily: l==='Claim ID'?'monospace':'inherit' }}>{v}</span>
              </div>
            ) : null)}
          </div>

          {/* Decision buttons */}
          <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-soft)',
            textTransform:'uppercase', letterSpacing:.3, marginBottom:8 }}>
            Decision *
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            {[
              ['approved', 'Approve', '#16a34a', 'var(--green-light)', '#86efac'],
              ['rejected', 'Reject',  '#dc2626', 'var(--red-light)',   '#fca5a5'],
            ].map(([val, lbl, clr, bg, border]) => (
              <button key={val} onClick={() => { setDecision(val); setError('') }}
                style={{
                  padding:'14px', borderRadius:10, cursor:'pointer',
                  fontWeight:700, fontSize:15, fontFamily:'var(--font-body)',
                  border: `2px solid ${decision===val ? clr : 'var(--border)'}`,
                  background: decision===val ? bg : '#fff',
                  color: decision===val ? clr : 'var(--ink)',
                  transition:'all .15s',
                }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Remarks */}
          <div style={{ fontSize:12, fontWeight:600, color:'var(--ink-soft)',
            textTransform:'uppercase', letterSpacing:.3, marginBottom:8 }}>
            Remarks {decision === 'rejected'
              ? <span style={{ color:'var(--red)' }}>*</span>
              : <span style={{ fontWeight:400, textTransform:'none' }}>(optional)</span>}
          </div>
          <textarea className="input" rows={4}
            style={{ resize:'vertical', lineHeight:1.6 }}
            placeholder={decision === 'rejected'
              ? 'Explain the reason for rejection…'
              : 'Add any notes for the patient (optional)…'}
            value={remarks}
            onChange={e => { setRemarks(e.target.value); setError('') }} />

          {error && <p className="error-msg" style={{ marginTop:8 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)',
          display:'flex', justifyContent:'flex-end', gap:10, background:'var(--paper)' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn" disabled={saving || !decision}
            onClick={handleSubmit}
            style={{
              minWidth:160,
              background: !decision ? '#94a3b8'
                : decision==='approved' ? '#16a34a' : 'var(--red)',
              color:'#fff',
            }}>
            {saving
              ? <><span className="spinner" /> Saving…</>
              : decision === 'approved' ? 'Confirm Approval'
              : decision === 'rejected' ? 'Confirm Rejection'
              : 'Select a decision'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Document viewer ─────────────────────────────────────────────────────── */
function DocViewer({ claim, onClose }) {
  const fname  = claim.document_path?.split(/[\\/]/).pop()
  const docUrl = fname ? `/api/uploads/${fname}` : null
  const isPdf  = docUrl?.toLowerCase().endsWith('.pdf')

  return (
    <div style={S.overlay}>
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 24px 80px rgba(0,0,0,.22)',
        width:'100%', maxWidth:800, height:'90vh',
        display:'flex', flexDirection:'column', overflow:'hidden' }}>

        <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:400 }}>
              Document Viewer
            </h3>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
              <code style={{ fontSize:11, color:'var(--teal-dark)' }}>{claim.claim_id}</code>
              <StatusBadge status={claim.status} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {docUrl && (
              <a href={docUrl} target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ fontSize:12, padding:'6px 12px' }}>
                Open in new tab
              </a>
            )}
            <button onClick={onClose}
              style={{ background:'none', border:'none', fontSize:20,
                color:'var(--ink-faint)', cursor:'pointer' }}>x</button>
          </div>
        </div>

        <div style={{ flex:1, overflow:'hidden' }}>
          {docUrl ? (
            isPdf ? (
              <iframe src={docUrl} style={{ width:'100%', height:'100%', border:'none' }} title="document" />
            ) : (
              <div style={{ width:'100%', height:'100%', background:'#111',
                display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                <img src={docUrl} alt="claim document"
                  style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:6 }} />
              </div>
            )
          ) : (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', color:'var(--ink-faint)', gap:10 }}>
              <div style={{ fontSize:40 }}>[ ]</div>
              <p>No document attached to this claim.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  page:    { minHeight:'100vh', background:'var(--paper)', display:'flex', flexDirection:'column' },
  nav:     { background:'linear-gradient(90deg,#0f766e,#0d9488)', padding:'0 28px', height:60,
             display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  brand:   { display:'flex', alignItems:'center', gap:12 },
  logo:    { width:36, height:36, background:'rgba(255,255,255,.25)', color:'#fff', borderRadius:9,
             display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 },
  layout:  { display:'grid', gridTemplateColumns:'360px 1fr', flex:1,
             overflow:'hidden', height:'calc(100vh - 60px)' },
  sidebar: { borderRight:'1px solid var(--border)', background:'#fff',
             display:'flex', flexDirection:'column', overflow:'hidden', padding:16 },
  statsRow:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 },
  statCard:{ background:'var(--paper)', border:'1.5px solid', borderRadius:8,
             padding:'10px 6px', textAlign:'center', cursor:'pointer', transition:'border-color .15s' },
  ftab:    { padding:'5px 10px', borderRadius:99, border:'1px solid var(--border)',
             background:'none', cursor:'pointer', fontSize:12, fontWeight:500,
             color:'var(--ink-soft)', fontFamily:'var(--font-body)',
             display:'inline-flex', alignItems:'center', gap:5, transition:'all .12s' },
  ftabActive: { background:'var(--teal)', color:'#fff', borderColor:'var(--teal)' },
  bubble:  { borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700,
             minWidth:16, textAlign:'center' },
  claimList: { overflowY:'auto', flex:1, marginTop:8 },
  row:     { padding:'12px 14px', borderRadius:8, marginBottom:6, cursor:'pointer',
             border:'1.5px solid transparent', background:'var(--paper)', transition:'all .12s' },
  rowActive: { borderColor:'var(--teal)', background:'#f0fdfb' },
  detail:  { overflow:'hidden', display:'flex', flexDirection:'column' },
  overlay: { position:'fixed', inset:0, background:'rgba(13,17,23,.55)',
             backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
             justifyContent:'center', zIndex:1000, padding:16 },
}