// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — DASHBOARD
// Searchable table of saved quotes. Click any row to re-open the form.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { apiGetQuotes, apiGetQuote } from '../api/quotes.js'
import { fmt } from '../components/UI.jsx'

const BLUE = '#2B3990'
const RED  = '#ED1C24'
const MONO = "'IBM Plex Mono',monospace"
const SERIF= "'DM Serif Display',Georgia,serif"

const STATUS_STYLES = {
  Pending: { bg:'#fffbeb', border:'#fde68a', text:'#92400e', dot:'#f59e0b' },
  Won:     { bg:'#f0fdf4', border:'#86efac', text:'#15803d', dot:'#22c55e' },
  Lost:    { bg:'#fef2f2', border:'#fecaca', text:'#b91c1c', dot:'#ef4444' },
}

const PRICE_STATUS_STYLES = {
  good:         { bg:'#f0fdf4', text:'#15803d' },
  below_target: { bg:'#f0f9ff', text:'#0369a1' },
  approval:     { bg:'#fffbeb', text:'#92400e' },
  loss:         { bg:'#fef2f2', text:'#b91c1c' },
  unset:        { bg:'#f8fafc', text:'#64748b' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, fontSize:10, fontFamily:MONO, fontWeight:600, background:s.bg, border:`1px solid ${s.border}`, color:s.text }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, flexShrink:0 }}/>
      {status}
    </span>
  )
}

function PriceStatusBadge({ priceStatus }) {
  const s = PRICE_STATUS_STYLES[priceStatus] || PRICE_STATUS_STYLES.unset
  const labels = { good:'OK', below_target:'Below Target', approval:'Needs Approval', loss:'Loss', unset:'—' }
  return (
    <span style={{ padding:'2px 7px', borderRadius:4, fontSize:9, fontFamily:MONO, background:s.bg, color:s.text, fontWeight:600 }}>
      {labels[priceStatus] || '—'}
    </span>
  )
}

export function Dashboard({ onOpenQuote }) {
  const [quotes,   setQuotes]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')  // All | Pending | Won | Lost
  const [opening,  setOpening]  = useState(null)   // id being loaded

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setQuotes(await apiGetQuotes()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpen = useCallback(async (id) => {
    setOpening(id)
    try {
      const fullForm = await apiGetQuote(id)
      onOpenQuote(fullForm)
    } catch (e) {
      alert('Could not load quote: ' + e.message)
    } finally {
      setOpening(null)
    }
  }, [onOpenQuote])

  // Filter + search — search also matches `customerText` so reps can find
  // unlinked quotes (e.g. customer not yet in master) by what they typed.
  const visible = quotes.filter(q => {
    const matchStatus = filter === 'All' || q.status === filter
    const term = search.toLowerCase()
    const matchSearch = !term ||
      (q.customer     || '').toLowerCase().includes(term) ||
      (q.customerText || '').toLowerCase().includes(term) ||
      (q.quoteRef     || '').toLowerCase().includes(term) ||
      (q.productDesc  || '').toLowerCase().includes(term) ||
      (q.preparedBy   || '').toLowerCase().includes(term)
    return matchStatus && matchSearch
  })

  // Summary stats
  const total   = quotes.length
  const pending = quotes.filter(q => q.status === 'Pending').length
  const won     = quotes.filter(q => q.status === 'Won').length
  const totalRev = quotes
    .filter(q => q.status !== 'Lost')
    .reduce((s, q) => s + (parseFloat(q.sellingPrice)||0) * (parseFloat(q.qty)||0), 0)

  if (error) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 52px)', gap:12 }}>
      <div style={{ fontSize:13, fontFamily:MONO, color:'#b91c1c' }}>Could not connect to API server</div>
      <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8' }}>Make sure you started with <code style={{ background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>npm run dev</code> (not npm run ui)</div>
      <button onClick={load} style={{ padding:'8px 20px', background:BLUE, border:'none', borderRadius:6, color:'#fff', fontFamily:MONO, fontSize:11, cursor:'pointer', marginTop:8 }}>Retry</button>
    </div>
  )

  return (
    <div style={{ background:'#f1f5f9', minHeight:'calc(100vh - 52px)', padding:'clamp(12px, 3vw, 24px)' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:SERIF, fontSize:22, color:'#1e293b' }}>Quote Dashboard</div>
            <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8', marginTop:3 }}>
              {total} saved quote{total !== 1 ? 's' : ''} · click any row to re-open
            </div>
          </div>
          <button onClick={load} style={{ padding:'8px 16px', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:7, fontFamily:MONO, fontSize:11, cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center', gap:6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Refresh
          </button>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Total Quotes',   value:total,                 sub:'all time',          color:BLUE,     bg:'#f0f4ff' },
            { label:'Open / Pending', value:pending,               sub:'awaiting decision', color:'#92400e',bg:'#fffbeb' },
            { label:'Won',            value:won,                   sub:'confirmed orders',  color:'#15803d',bg:'#f0fdf4' },
            { label:'Pipeline Value', value:'KES '+fmt(totalRev,0),sub:'pending + won',     color:'#0369a1',bg:'#f0f9ff' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:10, padding:'16px 18px', border:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:9, fontFamily:MONO, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontSize:24, fontFamily:SERIF, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, fontFamily:MONO, color:'#94a3b8', marginTop:3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTER ── */}
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {/* Search */}
          <div style={{ flex:1, position:'relative' }}>
            <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, ref, product, sales rep..."
              style={{ width:'100%', padding:'9px 12px 9px 32px', border:'1.5px solid #e2e8f0', borderRadius:7, fontFamily:MONO, fontSize:11, color:'#1e293b', outline:'none', boxSizing:'border-box', background:'#fff' }}
            />
          </div>
          {/* Status filter */}
          <div style={{ display:'flex', background:'#e2e8f0', borderRadius:8, padding:3, gap:0 }}>
            {['All','Pending','Won','Lost'].map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding:'7px 16px', border:'none', borderRadius:6, fontFamily:MONO, fontSize:11, cursor:'pointer', fontWeight:600, transition:'all .15s',
                background: filter===s ? '#fff'         : 'transparent',
                color:      filter===s ? '#1e293b'      : '#64748b',
                boxShadow:  filter===s ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* ── TABLE ── (horizontal scroll on narrow viewports) */}
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
         <div style={{ minWidth:910 }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 120px 90px 90px 100px 110px 110px', gap:0, borderBottom:'2px solid #2B3990', background:'#f8fafc' }}>
            {['Ref','Customer / Product','Sales Rep','Type','Dims (mm)','Qty','Price / pc','Status'].map((h,i) => (
              <div key={h} style={{ padding:'10px 12px', fontSize:9, fontFamily:MONO, color:BLUE, textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, borderRight: i<7 ? '1px solid #e2e8f0' : 'none' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding:40, textAlign:'center', fontFamily:MONO, fontSize:11, color:'#94a3b8' }}>Loading quotes...</div>
          ) : visible.length === 0 ? (
            <div style={{ padding:40, textAlign:'center' }}>
              <div style={{ fontSize:13, fontFamily:SERIF, color:'#1e293b', marginBottom:6 }}>
                {quotes.length === 0 ? 'No quotes saved yet' : 'No quotes match your search'}
              </div>
              <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8' }}>
                {quotes.length === 0 ? 'Fill in a quote and click "Save Quote" to get started.' : 'Try a different search or filter.'}
              </div>
            </div>
          ) : visible.map((q, i) => {
            const isOpening = opening === q.id
            const isSFK = q.productType === 'sfk'
            const sp  = parseFloat(q.sellingPrice) || 0
            const qty = parseFloat(q.qty) || 0
            return (
              <div
                key={q.id}
                onClick={() => !isOpening && handleOpen(q.id)}
                style={{
                  display:'grid', gridTemplateColumns:'140px 1fr 120px 90px 90px 100px 110px 110px',
                  borderBottom: i < visible.length-1 ? '1px solid #f1f5f9' : 'none',
                  cursor: isOpening ? 'wait' : 'pointer',
                  background: isOpening ? '#f0f4ff' : 'transparent',
                  transition:'background .1s',
                }}
                onMouseEnter={e => { if (!isOpening) e.currentTarget.style.background='#f8fafc' }}
                onMouseLeave={e => { if (!isOpening) e.currentTarget.style.background='transparent' }}
              >
                {/* Ref + lifecycle chip (Draft / Submitted / Cancelled) */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9' }}>
                  <div style={{ fontSize:10, fontFamily:MONO, fontWeight:700, color:BLUE }}>{q.quoteRef}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    <span style={{ fontSize:9, fontFamily:MONO, color:'#94a3b8' }}>
                      {q.savedAt ? new Date(q.savedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                    </span>
                    {q.docstatus === 1 && <span style={{ fontSize:8, fontFamily:MONO, fontWeight:700, padding:'1px 5px', borderRadius:3, background:'#fef3c7', color:'#92400e', textTransform:'uppercase', letterSpacing:'.06em' }}>Submitted</span>}
                    {q.docstatus === 2 && <span style={{ fontSize:8, fontFamily:MONO, fontWeight:700, padding:'1px 5px', borderRadius:3, background:'#fee2e2', color:'#991b1b', textTransform:'uppercase', letterSpacing:'.06em' }}>Cancelled</span>}
                  </div>
                </div>
                {/* Customer / Product — italic when only the typed text is on file (no Customer master record yet) */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9', minWidth:0 }}>
                  {q.customer ? (
                    <div style={{ fontSize:11, fontFamily:MONO, fontWeight:600, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.customer}</div>
                  ) : q.customerText ? (
                    <div title="Free-text — not yet linked to a Customer master record" style={{ fontSize:11, fontFamily:MONO, fontWeight:500, fontStyle:'italic', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.customerText}</div>
                  ) : (
                    <div style={{ fontSize:11, fontFamily:MONO, fontWeight:600, color:'#1e293b' }}>—</div>
                  )}
                  <div style={{ fontSize:10, fontFamily:MONO, color:'#64748b', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.productDesc || '—'}</div>
                </div>
                {/* Sales Rep */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9', display:'flex', alignItems:'center' }}>
                  <span style={{ fontSize:10, fontFamily:MONO, color:'#475569' }}>{q.preparedBy || '—'}</span>
                </div>
                {/* Type */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9', display:'flex', alignItems:'center' }}>
                  <span style={{ fontSize:9, fontFamily:MONO, padding:'2px 7px', borderRadius:4, background: isSFK?'#fdf4ff':'#f0f4ff', color: isSFK?'#7c3aed':BLUE, fontWeight:600 }}>
                    {isSFK ? 'SFK' : (q.styleCode || 'Carton')}
                  </span>
                </div>
                {/* Dims */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9', display:'flex', alignItems:'center' }}>
                  <span style={{ fontSize:10, fontFamily:MONO, color:'#475569' }}>
                    {isSFK
                      ? (q.sfkWidth ? q.sfkWidth+'mm' : '—')
                      : (q.dimL && q.dimW && q.dimH ? `${q.dimL}×${q.dimW}×${q.dimH}` : '—')
                    }
                  </span>
                </div>
                {/* Qty */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9', display:'flex', alignItems:'center' }}>
                  <span style={{ fontSize:11, fontFamily:MONO, color:'#1e293b', fontWeight:600 }}>
                    {qty ? qty.toLocaleString() : '—'}
                  </span>
                </div>
                {/* Price + margin */}
                <div style={{ padding:'12px 12px', borderRight:'1px solid #f1f5f9' }}>
                  <div style={{ fontSize:11, fontFamily:MONO, fontWeight:700, color:'#1e293b' }}>
                    {sp ? 'KES '+fmt(sp) : '—'}
                  </div>
                  {q.priceStatus && q.priceStatus !== 'unset' && (
                    <div style={{ marginTop:3 }}>
                      <PriceStatusBadge priceStatus={q.priceStatus}/>
                    </div>
                  )}
                </div>
                {/* Status */}
                <div style={{ padding:'12px 12px', display:'flex', alignItems:'center' }}>
                  {isOpening
                    ? <span style={{ fontSize:10, fontFamily:MONO, color:BLUE }}>Opening...</span>
                    : <StatusBadge status={q.status || 'Pending'}/>
                  }
                </div>
              </div>
            )
          })}
         </div>
        </div>

        {visible.length > 0 && (
          <div style={{ marginTop:10, fontSize:10, fontFamily:MONO, color:'#94a3b8', textAlign:'right' }}>
            {visible.length} of {quotes.length} quote{quotes.length !== 1 ? 's' : ''}
            {filter !== 'All' || search ? ` (filtered)` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
