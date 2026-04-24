import { useState, useEffect } from 'react'
import { editClaim } from '../services/api'

const FIELD_CONFIG = [
  { key: 'patient_name',    label: 'Patient Name',       icon: '', type: 'text',   required: true },
  { key: 'hospital_name',   label: 'Hospital / Clinic',  icon: '', type: 'text',   required: true },
  { key: 'admission_date',  label: 'Admission Date',     icon: '', type: 'text',   placeholder: 'DD/MM/YYYY' },
  { key: 'discharge_date',  label: 'Discharge Date',     icon: '', type: 'text',   placeholder: 'DD/MM/YYYY' },
  { key: 'total_amount',    label: 'Total Amount (₹)',   icon: '', type: 'text',   placeholder: 'e.g. 45200' },
  { key: 'diagnosis',       label: 'Diagnosis',          icon: '', type: 'text' },
  { key: 'doctor_name',     label: 'Doctor Name',        icon: '', type: 'text' },
  { key: 'policy_number',   label: 'Policy Number',      icon: '', type: 'text' },
]

export default function EditClaimModal({ claim, onClose, onSaved }) {
  const [fields, setFields]   = useState({})
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [dirty, setDirty]     = useState(false)        // track unsaved changes

  // Seed form from claim on mount
  useEffect(() => {
    if (!claim) return
    const ed = claim.extracted_data || {}
    const initial = {}
    FIELD_CONFIG.forEach(f => { initial[f.key] = ed[f.key] || '' })
    setFields(initial)
    setNotes(claim.notes || '')
  }, [claim])

  const change = (key, val) => {
    setFields(p => ({ ...p, [key]: val }))
    setError('')
    setSuccess(false)
    setDirty(true)
  }

  const validate = () => {
    for (const f of FIELD_CONFIG) {
      if (f.required && !fields[f.key]?.trim()) {
        return `${f.label} is required.`
      }
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }

    setSaving(true)
    setError('')
    try {
      const payload = { ...fields, notes }
      // Strip empty strings → send as null so backend skips them
      const clean = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v.trim() || null])
      )
      await editClaim(claim.claim_id, clean)
      setSuccess(true)
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    onClose()
  }

  const isPending = claim?.status === 'pending'

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>
              {isPending ? 'Edit Claim' : 'View Claim'}
            </h2>
            <div style={S.claimMeta}>
              <code style={S.claimId}>{claim?.claim_id}</code>
              <span className={`badge badge-${claim?.status}`}>
                {claim?.status?.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
                {claim?.insurance_company}
              </span>
            </div>
          </div>
          <button style={S.closeBtn} onClick={handleClose}></button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>
          {!isPending && (
            <div style={S.readonlyBanner}>
               This claim is <strong>{claim?.status?.replace('_', ' ')}</strong> and can no longer be edited.
              {claim?.remarks && (
                <div style={{ marginTop: 8 }}>
                  <strong>Insurer remarks:</strong> {claim.remarks}
                </div>
              )}
            </div>
          )}

          {/* Field grid */}
          <div style={S.grid}>
            {FIELD_CONFIG.map(f => (
              <div key={f.key} style={S.fieldWrap}>
                <label style={S.label}>
                  <span style={{ marginRight: 5 }}>{f.icon}</span>
                  {f.label}
                  {f.required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={f.type || 'text'}
                    value={fields[f.key] || ''}
                    placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
                    onChange={e => change(f.key, e.target.value)}
                    disabled={!isPending || saving}
                    style={{
                      ...(isPending ? {} : S.readonlyInput),
                      borderColor: f.required && !fields[f.key]?.trim() && error ? 'var(--red)' : undefined,
                    }}
                  />
                  {/* Changed indicator */}
                  {isPending && fields[f.key] !== (claim?.extracted_data?.[f.key] || '') && (
                    <span style={S.changedDot} title="Modified" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div style={{ marginTop: 4 }}>
            <label style={S.label}> Additional Notes</label>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={e => { setNotes(e.target.value); setDirty(true) }}
              disabled={!isPending || saving}
              placeholder="Any extra context for the insurer…"
              style={{ resize: 'vertical', ...(!isPending ? S.readonlyInput : {}) }}
            />
          </div>

          {/* Change summary */}
          {dirty && isPending && (
            <ChangeSummary original={claim?.extracted_data || {}} current={fields} />
          )}

          {/* Feedback */}
          {error   && <p className="error-msg"   style={{ marginTop: 12 }}>{error}</p>}
          {success && <p className="success-msg" style={{ marginTop: 12 }}> Changes saved successfully.</p>}
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <button className="btn btn-ghost" onClick={handleClose} disabled={saving}>
            {isPending ? 'Cancel' : 'Close'}
          </button>
          {isPending && (
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !dirty}
              style={{ minWidth: 120 }}
            >
              {saving
                ? <><span className="spinner" /> Saving…</>
                : dirty ? 'Save Changes' : 'No Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-component: shows what changed ─────────────────────────────────────── */
function ChangeSummary({ original, current }) {
  const changed = Object.entries(current).filter(([k, v]) => {
    const orig = original[k] || ''
    return v.trim() !== orig.trim()
  })
  if (!changed.length) return null
  const label = { patient_name:'Patient Name', hospital_name:'Hospital', admission_date:'Admission', discharge_date:'Discharge', total_amount:'Amount', diagnosis:'Diagnosis', doctor_name:'Doctor', policy_number:'Policy No.' }
  return (
    <div style={S.changeSummary}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#92400e' }}>
         {changed.length} unsaved change{changed.length !== 1 ? 's' : ''}
      </div>
      {changed.map(([k, v]) => (
        <div key={k} style={S.changeRow}>
          <span style={{ color: '#78350f', minWidth: 90, display:'inline-block' }}>{label[k] || k}</span>
          <span style={S.strikethrough}>{original[k] || '—'}</span>
          <span style={{ margin: '0 6px', color: '#d97706' }}>→</span>
          <span style={{ color: '#065f46', fontWeight: 600 }}>{v || '—'}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(13,17,23,.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.22)',
    width: '100%', maxWidth: 680,
    maxHeight: '92vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '22px 28px 18px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 22, fontWeight: 400,
    marginBottom: 8,
  },
  claimMeta: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  claimId: {
    fontSize: 12, background: 'var(--paper)',
    border: '1px solid var(--border)',
    padding: '2px 8px', borderRadius: 6,
    color: 'var(--teal-dark)', fontWeight: 600,
  },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: 18, color: 'var(--ink-faint)',
    cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
    flexShrink: 0,
  },
  body: {
    padding: '20px 28px',
    overflowY: 'auto', flex: 1,
  },
  footer: {
    padding: '16px 28px',
    borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'flex-end', gap: 12,
    flexShrink: 0,
    background: 'var(--paper)',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
    marginBottom: 16,
  },
  fieldWrap: { marginBottom: 12, position: 'relative' },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--ink-soft)', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: .3,
  },
  readonlyInput: {
    background: 'var(--paper)',
    color: 'var(--ink-soft)',
    cursor: 'default',
  },
  readonlyBanner: {
    background: '#f0f9ff', border: '1px solid #bae6fd',
    borderRadius: 8, padding: '12px 16px',
    fontSize: 13, color: '#0369a1',
    marginBottom: 20, lineHeight: 1.6,
  },
  changedDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--amber)',
    display: 'block',
  },
  changeSummary: {
    background: '#fffbeb', border: '1px solid #fcd34d',
    borderRadius: 8, padding: '12px 14px', marginTop: 12,
    fontSize: 13,
  },
  changeRow: {
    display: 'flex', alignItems: 'center',
    gap: 4, marginBottom: 4, flexWrap: 'wrap',
  },
  strikethrough: {
    textDecoration: 'line-through', color: '#9ca3af',
    fontSize: 12,
  },
}