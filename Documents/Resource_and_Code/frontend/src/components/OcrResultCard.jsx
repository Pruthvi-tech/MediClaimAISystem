/**
 * OcrResultCard
 * Shows extracted fields with individual confidence indicators.
 * Used inside UploadPage Step 1→2 transition.
 */
import { useState } from 'react'

const FIELD_LABELS = {
  patient_name:    { label: 'Patient Name',    icon: '' },
  hospital_name:   { label: 'Hospital / Clinic', icon: '' },
  admission_date:  { label: 'Admission Date',  icon: '' },
  discharge_date:  { label: 'Discharge Date',  icon: '' },
  total_amount:    { label: 'Total Amount',    icon: '' },
  diagnosis:       { label: 'Diagnosis',       icon: '' },
  doctor_name:     { label: 'Doctor Name',     icon: '' },
  policy_number:   { label: 'Policy Number',   icon: '' },
}

function confidenceColor(score) {
  if (score >= 75) return '#16a34a'
  if (score >= 45) return '#d97706'
  return '#dc2626'
}
function confidenceLabel(score) {
  if (!score) return 'Not found'
  if (score >= 75) return 'High'
  if (score >= 45) return 'Medium'
  return 'Low'
}

export default function OcrResultCard({ fields = {}, confidence = {}, ocquality = 0, rawText = '' }) {
  const allFields = Object.keys(FIELD_LABELS)
  const foundCount = allFields.filter(k => fields[k]).length

  return (
    <div style={S.card}>
      {/* Header row */}
      <div style={S.header}>
        <div>
          <span style={S.headerTitle}>OCR Extraction Result</span>
          <span style={S.fieldCount}>{foundCount}/{allFields.length} fields extracted</span>
        </div>
        <QualityBadge score={ocquality} />
      </div>

      {/* Field grid */}
      <div style={S.grid}>
        {allFields.map(key => {
          const meta  = FIELD_LABELS[key]
          const val   = fields[key]
          const conf  = confidence[key] || 0
          const color = confidenceColor(conf)
          return (
            <div key={key} style={{ ...S.fieldBox, borderLeft: `3px solid ${val ? color : '#e2e8f0'}` }}>
              <div style={S.fieldTop}>
                <span style={S.fieldIcon}>{meta.icon}</span>
                <span style={S.fieldLabel}>{meta.label}</span>
                {val && (
                  <span style={{ ...S.confBadge, background: color + '18', color }}>
                    {confidenceLabel(conf)} {conf}%
                  </span>
                )}
              </div>
              {val ? (
                <>
                  <div style={S.fieldValue}>{key === 'total_amount' ? `₹ ${val}` : val}</div>
                  <div style={S.confBar}>
                    <div style={{ ...S.confFill, width: `${conf}%`, background: color }} />
                  </div>
                </>
              ) : (
                <div style={S.notFound}>— not detected —</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Raw text toggle */}
      {rawText && <RawTextToggle text={rawText} />}
    </div>
  )
}

function QualityBadge({ score }) {
  const color = confidenceColor(score)
  const label = score >= 75 ? 'Good' : score >= 45 ? 'Fair' : 'Poor'
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>OCR QUALITY</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}% {label}</span>
      </div>
    </div>
  )
}

function RawTextToggle({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <button onClick={() => setOpen(o => !o)} style={S.rawToggle}>
        {open ? '▲' : '▼'} {open ? 'Hide' : 'Show'} raw OCR text
      </button>
      {open && (
        <pre style={S.rawPre}>{text}</pre>
      )}
    </div>
  )
}

// We need useState in RawTextToggle
const S = {
  card: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
  },
  headerTitle: {
    fontWeight: 700, fontSize: 14,
    display: 'block',
    marginBottom: 4,
  },
  fieldCount: {
    fontSize: 12, color: 'var(--ink-soft)',
    background: 'var(--paper)',
    padding: '2px 8px', borderRadius: 99,
    border: '1px solid var(--border)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  fieldBox: {
    background: 'var(--paper)',
    borderRadius: 8,
    padding: '10px 12px',
    borderLeft: '3px solid',
  },
  fieldTop: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  fieldIcon: { fontSize: 14 },
  fieldLabel: {
    fontSize: 11, fontWeight: 600,
    color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .4,
    flex: 1,
  },
  confBadge: {
    fontSize: 10, fontWeight: 700,
    padding: '2px 6px', borderRadius: 99,
    whiteSpace: 'nowrap',
  },
  fieldValue: {
    fontSize: 14, fontWeight: 600,
    color: 'var(--ink)',
    marginBottom: 6,
    wordBreak: 'break-word',
  },
  notFound: {
    fontSize: 12, color: 'var(--ink-faint)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  confBar: {
    height: 3, background: '#e2e8f0',
    borderRadius: 99, overflow: 'hidden',
  },
  confFill: {
    height: '100%', borderRadius: 99,
    transition: 'width .4s ease',
  },
  rawToggle: {
    background: 'none', border: 'none',
    color: 'var(--teal)', fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
    padding: '4px 0',
  },
  rawPre: {
    marginTop: 10,
    background: '#0d1117', color: '#e2e8f0',
    borderRadius: 8, padding: 14,
    fontSize: 11, lineHeight: 1.6,
    overflow: 'auto', maxHeight: 220,
    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
}