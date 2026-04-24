import { useState, useEffect } from 'react'
import { getClaim } from '../services/api'

const STATUS_COLOR = {
  pending:      { bg: '#fef3c7', text: '#92400e', dot: '#d97706' },
  under_review: { bg: '#ede9fe', text: '#5b21b6', dot: '#7c3aed' },
  approved:     { bg: '#dcfce7', text: '#166534', dot: '#16a34a' },
  rejected:     { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
}

const FIELD_ROWS = [
  { key: 'patient_name',   label: 'Patient Name'    },
  { key: 'hospital_name',  label: 'Hospital'        },
  { key: 'admission_date', label: 'Admission'       },
  { key: 'discharge_date', label: 'Discharge'       },
  { key: 'total_amount',   label: 'Total Amount'    },
  { key: 'diagnosis',      label: 'Diagnosis'       },
  { key: 'doctor_name',    label: 'Doctor'          },
  { key: 'policy_number',  label: 'Policy Number'   },
]

export default function ClaimReceipt({ claimId, onClose }) {
  const [claim, setClaim]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    getClaim(claimId)
      .then(r => setClaim(r.data))
      .catch(() => setError('Could not load claim details.'))
      .finally(() => setLoading(false))
  }, [claimId])

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <div style={S.brandMark}>+</div>
            <div>
              <div style={S.brandName}>MediClaim</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>Claim Confirmation</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}></button>
        </div>

        <div style={S.body}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
              <p style={{ marginTop: 12, color: 'var(--ink-soft)' }}>Loading claim…</p>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          {claim && (
            <>
              {/* Claim ID banner */}
              <div style={S.idBanner}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>CLAIM ID</div>
                <div style={S.claimIdText}>{claim.claim_id}</div>
                <StatusPill status={claim.status} />
              </div>

              {/* Meta row */}
              <div style={S.metaRow}>
                <MetaItem label="Submitted By"  value={claim.user_name} />
                <MetaItem label="Email"         value={claim.user_email} />
                <MetaItem label="Insurance Co." value={claim.insurance_company} />
                <MetaItem label="Submitted On"  value={new Date(claim.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })} />
              </div>

              {/* Extracted fields */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Extracted Medical Details</div>
                <div style={S.fieldsGrid}>
                  {FIELD_ROWS.map(({ key, label }) => {
                    const val = claim.extracted_data?.[key]
                    return (
                      <div key={key} style={S.fieldRow}>
                        <span style={S.fieldLabel}>{label}</span>
                        <span style={{ ...S.fieldValue, color: val ? 'var(--ink)' : 'var(--ink-faint)', fontStyle: val ? 'normal' : 'italic' }}>
                          {key === 'total_amount' && val ? `₹ ${val}` : val || 'Not provided'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              {claim.notes && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>Additional Notes</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{claim.notes}</p>
                </div>
              )}

              {/* Remarks (if reviewed) */}
              {claim.remarks && (
                <div style={{ ...S.section, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 16 }}>
                  <div style={{ ...S.sectionTitle, color: '#0369a1' }}>Insurer Remarks</div>
                  <p style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.6 }}>{claim.remarks}</p>
                </div>
              )}

              {/* Claim flow timeline */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Claim Journey</div>
                <Timeline status={claim.status} createdAt={claim.created_at} updatedAt={claim.updated_at} />
              </div>
            </>
          )}
        </div>

        <div style={S.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {claim && (
            <button
              className="btn btn-primary"
              onClick={() => {
                const text = `Claim ID: ${claim.claim_id}\nStatus: ${claim.status}\nInsurer: ${claim.insurance_company}\nAmount: ₹${claim.extracted_data?.total_amount || 'N/A'}`
                navigator.clipboard?.writeText(text)
                  .then(() => alert('Claim details copied to clipboard!'))
              }}
            >
               Copy Details
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const c = STATUS_COLOR[status] || { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.bg, color: c.text, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700, marginTop: 8 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {status.replace('_', ' ').toUpperCase()}
    </div>
  )
}

function MetaItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function Timeline({ status, createdAt, updatedAt }) {
  const steps = [
    { key: 'pending',      label: 'Submitted',    icon: '', done: true },
    { key: 'under_review', label: 'Under Review', icon: '', done: ['under_review','approved','rejected'].includes(status) },
    { key: 'approved',     label: status === 'rejected' ? 'Rejected' : 'Approved', icon: status === 'rejected' ? '' : '', done: ['approved','rejected'].includes(status) },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
              background: s.done ? 'var(--teal)' : '#e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              {s.done ? s.icon : '⭕'}
            </div>
            <div style={{ fontSize: 11, color: s.done ? 'var(--teal-dark)' : 'var(--ink-faint)', fontWeight: s.done ? 600 : 400 }}>
              {s.label}
            </div>
            {i === 0 && (
              <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                {new Date(createdAt).toLocaleDateString('en-IN')}
              </div>
            )}
            {i === 2 && s.done && (
              <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                {new Date(updatedAt).toLocaleDateString('en-IN')}
              </div>
            )}
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: steps[i + 1].done ? 'var(--teal)' : '#e2e8f0', margin: '0 4px', marginBottom: 20 }} />
          )}
        </div>
      ))}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(13,17,23,.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.22)',
    width: '100%', maxWidth: 580,
    maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '18px 24px', borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34, height: 34, background: 'var(--teal)', color: '#fff',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700,
  },
  brandName: { fontFamily: 'var(--font-display)', fontSize: 17 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18,
    color: 'var(--ink-faint)', cursor: 'pointer',
    padding: '4px 8px', borderRadius: 6,
  },
  body: { overflowY: 'auto', padding: '24px', flex: 1 },
  footer: {
    padding: '14px 24px', borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'flex-end', gap: 12,
    background: 'var(--paper)', flexShrink: 0,
  },
  idBanner: {
    background: 'linear-gradient(135deg, #0f766e, #0d9488)',
    borderRadius: 12, padding: '20px 24px', marginBottom: 20,
    color: '#fff',
  },
  claimIdText: {
    fontFamily: 'monospace', fontSize: 26, fontWeight: 700,
    letterSpacing: 2, marginBottom: 4,
  },
  metaRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 16, marginBottom: 24,
    padding: '16px', background: 'var(--paper)',
    borderRadius: 10, border: '1px solid var(--border)',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: .5, color: 'var(--ink-soft)',
    marginBottom: 10,
  },
  fieldsGrid: {
    border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
  },
  fieldRow: {
    display: 'flex', justifyContent: 'space-between',
    padding: '10px 14px', borderBottom: '1px solid var(--border)',
    ':last-child': { borderBottom: 'none' },
  },
  fieldLabel: { fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 },
  fieldValue: { fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '55%' },
}