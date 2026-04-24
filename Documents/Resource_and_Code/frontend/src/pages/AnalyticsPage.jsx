import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAnalytics } from '../services/api'

/* ─── colour tokens ──────────────────────────────────────────────────────── */
const C = {
  teal:    '#0d9488',
  tealL:   '#ccfbf1',
  amber:   '#d97706',
  amberL:  '#fef3c7',
  green:   '#16a34a',
  greenL:  '#dcfce7',
  red:     '#dc2626',
  redL:    '#fee2e2',
  purple:  '#7c3aed',
  purpleL: '#ede9fe',
  ink:     '#0d1117',
  soft:    '#4a5568',
  faint:   '#a0aec0',
  border:  '#e2e8f0',
  paper:   '#f7f8fc',
}

const STATUS_COLOR = {
  pending:      C.amber,
  under_review: C.purple,
  approved:     C.green,
  rejected:     C.red,
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getAnalytics()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  const isInsurer = user?.role === 'insurer'

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.brand}>
          <span style={S.logo}>+</span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:18 }}>MediClaim</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost" style={{ fontSize:13, padding:'6px 14px' }}
            onClick={() => navigate(isInsurer ? '/insurer' : '/dashboard')}>
            ← Dashboard
          </button>
          <span style={{ fontSize:13, color:'var(--ink-soft)' }}>{user?.name}</span>
          <button className="btn btn-ghost" style={{ padding:'6px 14px', fontSize:13 }}
            onClick={() => { logout(); navigate('/login') }}>Sign out</button>
        </div>
      </nav>

      <div style={S.content}>
        <div style={S.pageHead}>
          <h1 style={S.pageTitle}>Analytics</h1>
          <p style={{ color:C.soft, fontSize:14, marginTop:4 }}>
            {isInsurer ? `Claims routed to ${user?.company_name}` : 'Your claim activity at a glance'}
          </p>
        </div>

        {loading && (
          <div style={{ display:'flex', justifyContent:'center', padding:80 }}>
            <span className="spinner spinner-dark" style={{ width:32, height:32 }} />
          </div>
        )}
        {error && <p className="error-msg" style={{ textAlign:'center' }}>{error}</p>}

        {data && (
          <>
            {/* KPI cards */}
            <div style={S.kpiRow}>
              <KpiCard label="Total Claims"   value={data.total}          color={C.teal}   bg={C.tealL}   icon="" />
              <KpiCard label="Pending"        value={data.by_status.pending ?? 0}      color={C.amber}  bg={C.amberL}  icon="" />
              <KpiCard label="Under Review"   value={data.by_status.under_review ?? 0} color={C.purple} bg={C.purpleL} icon="" />
              <KpiCard label="Approved"       value={data.by_status.approved ?? 0}     color={C.green}  bg={C.greenL}  icon="" />
              <KpiCard label="Rejected"       value={data.by_status.rejected ?? 0}     color={C.red}    bg={C.redL}    icon="" />
            </div>

            {/* Second KPI row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
              <MetricCard
                label="Approval Rate"
                value={`${data.approval_rate}%`}
                sub={`${data.reviewed} claims reviewed`}
                color={data.approval_rate >= 60 ? C.green : C.red}
              />
              <MetricCard
                label="Avg. Claim Amount"
                value={data.avg_amount ? `₹${Number(data.avg_amount).toLocaleString('en-IN')}` : '—'}
                sub="across all claims"
                color={C.teal}
              />
              <MetricCard
                label="Highest Claim"
                value={data.max_amount ? `₹${Number(data.max_amount).toLocaleString('en-IN')}` : '—'}
                sub="single claim amount"
                color={C.purple}
              />
            </div>

            {/* Charts row */}
            <div style={S.chartRow}>
              {/* Donut chart */}
              <div style={S.chartCard}>
                <div style={S.chartTitle}>Claims by Status</div>
                <DonutChart data={data.by_status} total={data.total} />
              </div>

              {/* Bar chart – monthly */}
              <div style={{ ...S.chartCard, flex: 2 }}>
                <div style={S.chartTitle}>Monthly Submissions</div>
                {data.monthly_trend.length > 0
                  ? <BarChart data={data.monthly_trend} />
                  : <Empty label="No monthly data yet" />
                }
              </div>
            </div>

            {/* Insurer breakdown */}
            {data.top_insurers.length > 0 && (
              <div style={S.chartCard}>
                <div style={S.chartTitle}>
                  {isInsurer ? 'Claims Summary' : 'Claims by Insurance Company'}
                </div>
                <InsurerBars data={data.top_insurers} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, color, bg, icon }) {
  return (
    <div style={{ ...S.kpiCard, borderTop:`3px solid ${color}` }}>
      <div style={{ fontSize:28, marginBottom:4 }}>{icon}</div>
      <div style={{ fontSize:32, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13, color:C.soft, marginTop:6 }}>{label}</div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={S.metricCard}>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.5, color:C.faint, marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color, lineHeight:1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, color:C.soft }}>{sub}</div>
    </div>
  )
}

/* ─── Donut chart (pure SVG) ─────────────────────────────────────────────── */
function DonutChart({ data, total }) {
  if (!total) return <Empty label="No data yet" />

  const items = [
    { key:'approved',     label:'Approved',     color:C.green  },
    { key:'pending',      label:'Pending',      color:C.amber  },
    { key:'under_review', label:'Under Review', color:C.purple },
    { key:'rejected',     label:'Rejected',     color:C.red    },
  ].map(i => ({ ...i, value: data[i.key] ?? 0 })).filter(i => i.value > 0)

  const cx = 90, cy = 90, r = 68, stroke = 28
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        {items.map(item => {
          const pct = item.value / total
          const dash = pct * circ
          const gap  = circ - dash
          const seg = (
            <circle
              key={item.key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ / 1 + circ * 0.25}  /* start from top */
              style={{ transition:'stroke-dasharray .5s ease' }}
            />
          )
          offset += pct
          return seg
        })}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={28} fontWeight={700} fill={C.ink}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill={C.soft}>Total</text>
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {items.map(item => (
          <div key={item.key} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:item.color, flexShrink:0 }} />
            <span style={{ fontSize:13, color:C.soft }}>{item.label}</span>
            <span style={{ fontSize:14, fontWeight:700, color:item.color, marginLeft:'auto', paddingLeft:16 }}>
              {item.value}
            </span>
            <span style={{ fontSize:11, color:C.faint, minWidth:36 }}>
              ({Math.round(item.value / total * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Bar chart (pure SVG) ───────────────────────────────────────────────── */
function BarChart({ data }) {
  const W = 540, H = 180, PAD = { top:16, right:16, bottom:36, left:40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom
  const maxVal = Math.max(...data.map(d => d.count), 1)
  const barW   = Math.min(innerW / data.length - 8, 48)
  const slot   = innerW / data.length

  // Y gridlines at 25% intervals
  const gridLines = [0.25, 0.5, 0.75, 1].map(p => Math.round(maxVal * p))

  return (
    <div style={{ overflowX:'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:320, height:H }}>
        {/* Grid lines */}
        {gridLines.map(val => {
          const y = PAD.top + innerH - (val / maxVal) * innerH
          return (
            <g key={val}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                stroke={C.border} strokeWidth={1} strokeDasharray="4 2" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={C.faint}>{val}</text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const x    = PAD.left + i * slot + slot/2 - barW/2
          const barH = Math.max((d.count / maxVal) * innerH, 2)
          const y    = PAD.top + innerH - barH

          // Stacked: approved (green) on top, rest teal
          const approvedH = d.approved ? (d.approved / maxVal) * innerH : 0
          const rejectedH = d.rejected ? (d.rejected / maxVal) * innerH : 0
          const otherH    = barH - approvedH - rejectedH

          return (
            <g key={d.month}>
              {/* Other (pending/review) */}
              <rect x={x} y={y} width={barW} height={Math.max(otherH,0)} fill={C.teal} rx={3} opacity={.85} />
              {/* Rejected */}
              {rejectedH > 0 && <rect x={x} y={y + Math.max(otherH,0)} width={barW} height={rejectedH} fill={C.red} rx={0} opacity={.85} />}
              {/* Approved on top */}
              {approvedH > 0 && <rect x={x} y={PAD.top + innerH - approvedH} width={barW} height={approvedH} fill={C.green} rx={0} opacity={.9} />}

              {/* Value label */}
              <text x={x + barW/2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.soft}>{d.count}</text>
              {/* Month label */}
              <text x={x + barW/2} y={H - 6} textAnchor="middle" fontSize={10} fill={C.faint}>{d.label}</text>
            </g>
          )
        })}

        {/* X axis */}
        <line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH}
          stroke={C.border} strokeWidth={1} />
      </svg>

      {/* Bar chart legend */}
      <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
        {[['Other / Pending', C.teal],['Approved', C.green],['Rejected', C.red]].map(([l,c]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.soft }}>
            <div style={{ width:10, height:10, borderRadius:2, background:c }} />{l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Insurer horizontal bar chart ───────────────────────────────────────── */
function InsurerBars({ data }) {
  const max = Math.max(...data.map(d => d.total), 1)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {data.map(d => {
        const totalPct    = (d.total    / max) * 100
        const approvedPct = d.total > 0 ? (d.approved / d.total) * 100 : 0
        const shortName   = d.company.replace(/ Health(care|Insurance)?/i, '').trim()

        return (
          <div key={d.company}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{shortName}</span>
              <span style={{ fontSize:12, color:C.soft }}>
                {d.total} claim{d.total !== 1 ? 's' : ''}
                <span style={{ color:C.green, fontWeight:600, marginLeft:8 }}>· {d.approved} approved</span>
              </span>
            </div>
            {/* Track */}
            <div style={{ height:10, background:C.border, borderRadius:99, overflow:'hidden' }}>
              {/* Full bar */}
              <div style={{ height:'100%', width:`${totalPct}%`, background:C.tealL, borderRadius:99, position:'relative', transition:'width .4s ease' }}>
                {/* Approved segment */}
                <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${approvedPct}%`, background:C.green, borderRadius:99, transition:'width .4s ease' }} />
              </div>
            </div>
            <div style={{ fontSize:10, color:C.faint, marginTop:3 }}>
              {Math.round(approvedPct)}% approval rate
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Empty({ label }) {
  return (
    <div style={{ textAlign:'center', padding:'32px 0', color:C.faint }}>
      <div style={{ fontSize:32, marginBottom:8 }}></div>
      <div style={{ fontSize:13 }}>{label}</div>
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const S = {
  page:    { minHeight:'100vh', background:C.paper },
  nav: {
    background:'#fff', borderBottom:`1px solid ${C.border}`,
    padding:'0 28px', height:58,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    position:'sticky', top:0, zIndex:100,
  },
  brand:   { display:'flex', alignItems:'center', gap:10 },
  logo: {
    width:32, height:32, background:C.teal, color:'#fff',
    borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:18, fontWeight:700,
  },
  content:  { maxWidth:1100, margin:'0 auto', padding:'28px 24px' },
  pageHead: { marginBottom:24 },
  pageTitle:{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:400 },
  kpiRow:   { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:16 },
  kpiCard: {
    background:'#fff', border:`1px solid ${C.border}`, borderRadius:12,
    padding:'18px 16px', textAlign:'center', boxShadow:'var(--shadow)',
  },
  metricCard: {
    background:'#fff', border:`1px solid ${C.border}`, borderRadius:12,
    padding:'18px 20px', boxShadow:'var(--shadow)',
  },
  chartRow: { display:'grid', gridTemplateColumns:'1fr 2fr', gap:18, marginBottom:18 },
  chartCard: {
    background:'#fff', border:`1px solid ${C.border}`, borderRadius:12,
    padding:'20px 22px', boxShadow:'var(--shadow)',
    marginBottom:18,
  },
  chartTitle: {
    fontSize:13, fontWeight:700, color:C.soft,
    textTransform:'uppercase', letterSpacing:.5,
    marginBottom:18,
  },
}