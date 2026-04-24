import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInsurers, uploadDocument, submitClaim } from '../services/api'
import OcrResultCard from '../components/OcrResultCard'
import ClaimReceipt from '../components/ClaimReceipt'

const STEPS = ['Upload', 'Review & Edit', 'Submitted']

export default function UploadPage({ onClose }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)                  // 0=upload, 1=review, 2=done
  const [insurers, setInsurers] = useState([])
  const [selectedInsurer, setSelectedInsurer] = useState('')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)  // OCR result
  const [fields, setFields] = useState({})                // editable form
  const [notes, setNotes] = useState('')
  const [claimId, setClaimId]       = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const fileInput = useRef()

  useEffect(() => {
    getInsurers().then(r => setInsurers(r.data)).catch(() => {})
  }, [])

  // ── File validation ──────────────────────────────────────────────────────
  const ALLOWED = ['application/pdf','image/jpeg','image/png','image/bmp','image/tiff','image/webp']
  const validateFile = (f) => {
    if (!f) return 'No file selected.'
    if (!ALLOWED.includes(f.type) && !f.name.match(/\.(pdf|jpe?g|png|bmp|tiff|webp)$/i))
      return 'Only PDF, JPG, PNG, BMP, TIFF, WEBP allowed.'
    if (f.size > 10 * 1024 * 1024) return `File too large (${(f.size/1024/1024).toFixed(1)} MB). Max 10 MB.`
    return null
  }

  const onFilePick = (f) => {
    const err = validateFile(f)
    if (err) { setError(err); return }
    setFile(f)
    setError('')
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFilePick(f)
  }, [])

  // ── Upload → OCR ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setError('')
    if (!file) return setError('Please select a file.')
    if (!selectedInsurer) return setError('Please select an insurance company.')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('insurance_company', selectedInsurer)

    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await uploadDocument(fd, setUploadProgress)
      const data = res.data
      setUploadResult(data)
      const ed = data.extracted_data || {}
      setFields({
        patient_name:   ed.patient_name   || '',
        hospital_name:  ed.hospital_name  || '',
        admission_date: ed.admission_date || '',
        discharge_date: ed.discharge_date || '',
        total_amount:   ed.total_amount   || '',
        diagnosis:      ed.diagnosis      || '',
        doctor_name:    ed.doctor_name    || '',
        policy_number:  ed.policy_number  || '',
      })
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  // ── Submit claim ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        insurance_company: uploadResult.insurance_company,
        document_path: uploadResult.file_path,
        notes,
        extracted_data: {
          ...fields,
          raw_text: uploadResult.extracted_data?.raw_text || '',
        },
      }
      const res = await submitClaim(payload)
      setClaimId(res.data.claim_id)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fileIcon = file?.type === 'application/pdf' ? '' : ''

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>New Claim</h2>
            <div style={S.stepper}>
              {STEPS.map((s, i) => (
                <div key={s} style={S.stepItem}>
                  <div style={{
                    ...S.stepDot,
                    background: i < step ? 'var(--teal)' : i === step ? 'var(--teal)' : '#e2e8f0',
                    color: i <= step ? '#fff' : '#a0aec0',
                    boxShadow: i === step ? '0 0 0 4px rgba(13,148,136,.18)' : 'none',
                  }}>
                    {i < step ? '' : i + 1}
                  </div>
                  <span style={{ fontSize: 12, color: i === step ? 'var(--teal)' : 'var(--ink-faint)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
                  {i < STEPS.length - 1 && <div style={{ ...S.stepLine, background: i < step ? 'var(--teal)' : '#e2e8f0' }} />}
                </div>
              ))}
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}></button>
        </div>

        <div style={S.body}>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div>
              {/* Insurer dropdown */}
              <div style={S.field}>
                <label>Insurance Company *</label>
                <select
                  className="input"
                  value={selectedInsurer}
                  onChange={e => { setSelectedInsurer(e.target.value); setError('') }}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">— Select insurance company —</option>
                  {insurers.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Drop zone */}
              <div style={S.field}>
                <label>Medical Document *</label>
                <div
                  style={{
                    ...S.dropZone,
                    borderColor: dragOver ? 'var(--teal)' : file ? 'var(--teal)' : '#cbd5e0',
                    background: dragOver ? 'var(--teal-light)' : file ? '#f0fdfb' : '#fafbfc',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => !file && fileInput.current?.click()}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.webp"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files[0] && onFilePick(e.target.files[0])}
                  />
                  {file ? (
                    <div style={S.filePreview}>
                      <span style={{ fontSize: 40 }}>{fileIcon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{file.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {(file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                      <button
                        style={S.removeFile}
                        onClick={e => { e.stopPropagation(); setFile(null); setError('') }}
                      > Remove</button>
                    </div>
                  ) : (
                    <div style={S.dropPrompt}>
                      <div style={{ fontSize: 42, marginBottom: 12 }}></div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Drag & drop your document here</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0 16px' }}>
                        PDF, JPG, PNG, BMP, TIFF · Max 10 MB
                      </div>
                      <button className="btn btn-ghost" type="button" onClick={() => fileInput.current?.click()}>
                        Browse files
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {uploading && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    <span>{uploadProgress < 100 ? 'Uploading…' : 'Extracting text (OCR)…'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={S.progressTrack}>
                    <div style={{ ...S.progressBar, width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {error && <p className="error-msg">{error}</p>}

              <button
                className="btn btn-primary btn-full"
                style={{ marginTop: 8 }}
                onClick={handleUpload}
                disabled={uploading || !file || !selectedInsurer}
              >
                {uploading ? <><span className="spinner" /> Processing…</> : 'Upload & Extract →'}
              </button>
            </div>
          )}

          {/* ── STEP 1: Review & Edit ── */}
          {step === 1 && (
            <div>
              {uploadResult?.extracted_data && (
                <OcrResultCard
                  fields={fields}
                  confidence={uploadResult.extracted_data.confidence || {}}
                  ocquality={uploadResult.extracted_data.ocr_quality || 0}
                  rawText={uploadResult.extracted_data.raw_text || ''}
                />
              )}

              {uploadResult?.ocr_warning && (
                <div style={S.warnBox}>
                   OCR had trouble reading some fields. Please review and fill in any blanks below.
                </div>
              )}

              <div style={S.reviewGrid}>
                {[
                  ['patient_name',   'Patient Name'],
                  ['hospital_name',  'Hospital / Clinic'],
                  ['admission_date', 'Admission Date'],
                  ['discharge_date', 'Discharge Date'],
                  ['total_amount',   'Total Amount (₹)'],
                  ['diagnosis',      'Diagnosis'],
                  ['doctor_name',    'Doctor Name'],
                  ['policy_number',  'Policy Number'],
                ].map(([key, label]) => (
                  <div key={key} style={S.field}>
                    <label>
                      {label}
                      {fields[key] && <span style={S.autoTag}>auto-filled</span>}
                    </label>
                    <input
                      className="input"
                      value={fields[key] || ''}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div style={S.field}>
                <label>Additional Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  style={{ resize: 'vertical', lineHeight: 1.5 }}
                  placeholder="Any extra information for the insurer…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Document info chip */}
              <div style={S.docChip}>
                <span></span>
                <span style={{ fontWeight: 500 }}>{uploadResult?.original_filename}</span>
                <span style={{ color: 'var(--ink-faint)' }}>·</span>
                <span style={{ color: 'var(--ink-soft)' }}>{uploadResult?.file_size_kb} KB</span>
                <span style={{ color: 'var(--ink-faint)' }}>·</span>
                <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{uploadResult?.insurance_company}</span>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setStep(0); setError('') }} style={{ flex: 1 }}>
                  ← Back
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Claim →'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Success ── */}
          {step === 2 && (
            <div style={S.successPanel}>
              <div style={S.successIcon}></div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 8 }}>
                Claim Submitted!
              </h3>
              <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>
                Your claim has been routed to <strong>{uploadResult?.insurance_company}</strong>.
              </p>
              <div style={S.claimIdBox}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>CLAIM ID</span>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 1, color: 'var(--teal-dark)' }}>
                  {claimId}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 28 }}>
                A confirmation email has been sent to you.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%' }}>
                <button className="btn btn-primary btn-full" onClick={() => setShowReceipt(true)}>
                   View Claim Receipt
                </button>
                <button className="btn btn-ghost btn-full" onClick={onClose}>
                  Back to Dashboard
                </button>
              </div>
              {showReceipt && (
                <ClaimReceipt claimId={claimId} onClose={() => setShowReceipt(false)} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(13,17,23,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,.22)',
    width: '100%', maxWidth: 640,
    maxHeight: '92vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 28px 20px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 22, fontWeight: 400,
    marginBottom: 14,
  },
  stepper: {
    display: 'flex', alignItems: 'center', gap: 0,
  },
  stepItem: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
    transition: 'all .2s',
    flexShrink: 0,
  },
  stepLine: {
    width: 40, height: 2, borderRadius: 2,
    margin: '0 8px',
    transition: 'background .2s',
  },
  closeBtn: {
    background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 18,
    color: 'var(--ink-faint)', padding: '4px 8px',
    borderRadius: 6,
  },
  body: {
    overflowY: 'auto',
    padding: '24px 28px 28px',
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  dropZone: {
    border: '2px dashed',
    borderRadius: 12,
    padding: '32px 24px',
    cursor: 'pointer',
    transition: 'all .18s',
    minHeight: 160,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dropPrompt: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center',
  },
  filePreview: {
    display: 'flex', alignItems: 'center', gap: 16, width: '100%',
  },
  removeFile: {
    marginLeft: 'auto',
    background: 'none', border: '1px solid #fca5a5',
    color: 'var(--red)', borderRadius: 6,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer',
    fontWeight: 600,
  },
  progressTrack: {
    height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden',
  },
  progressBar: {
    height: '100%', background: 'var(--teal)',
    borderRadius: 99, transition: 'width .2s',
  },
  reviewGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0 16px',
  },
  autoTag: {
    marginLeft: 8,
    background: 'var(--teal-light)',
    color: 'var(--teal-dark)',
    fontSize: 10, fontWeight: 700,
    padding: '1px 6px', borderRadius: 99,
    verticalAlign: 'middle',
    textTransform: 'uppercase', letterSpacing: .5,
  },
  warnBox: {
    background: '#fef3c7', border: '1px solid #fcd34d',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: '#92400e',
    marginBottom: 16,
  },
  docChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--paper)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, marginBottom: 16,
    flexWrap: 'wrap',
  },
  successPanel: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', padding: '24px 0',
  },
  successIcon: {
    width: 72, height: 72,
    background: 'var(--teal)', color: '#fff',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 32, fontWeight: 700,
    marginBottom: 24,
    boxShadow: '0 0 0 12px var(--teal-light)',
  },
  claimIdBox: {
    background: 'var(--paper)', border: '1.5px solid var(--border)',
    borderRadius: 10, padding: '14px 32px',
    marginBottom: 16, textAlign: 'center',
  },
}