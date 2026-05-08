import { STATUS_CONFIG } from '../data/masterData.js'
import { computeCartonCost, computeSFKCost, simpleCheckFromWeight } from '../engine/costing.js'
import { useCosting } from '../context/CostingContext.jsx'
import { fmt } from './UI.jsx'

export function CostPanel({ cost, isSFK, form, style, board }) {
  const { rates } = useCosting()
  const sc = cost ? STATUS_CONFIG[cost.priceStatus] : STATUS_CONFIG.unset
  const ladderQtys = isSFK ? [10,25,50,100,200] : [1000,2500,5000,10000,25000]
  const curQty = isSFK ? parseFloat(form.sfkQty)||0 : parseFloat(form.qty)||0

  if (!cost) return (
    <div style={{ textAlign:'center', padding:'40px 10px' }}>
      <div style={{ width:42,height:42,borderRadius:10,background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B3990" strokeWidth="1.5"><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/><path d="M9 15h3l8.5-8.5a1.5 1.5 0 00-3-3L9 12v3z"/></svg>
      </div>
      <p style={{ fontSize:11,color:'#94a3b8',lineHeight:1.7,fontFamily:"'IBM Plex Mono',monospace" }}>
        {isSFK ? 'Enter reel width, metres, and quantity to see live costing.' : 'Complete the specification above to see live costing.'}
      </p>
    </div>
  )

  return (
    <div style={{ animation:'slide-up .2s ease' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><tr style={{ borderBottom:'2px solid #2B3990' }}>
          {['Element','Each','Total'].map((h,i) => <th key={h} style={{ padding:'5px 0',fontSize:9,color:'#2B3990',fontFamily:"'IBM Plex Mono',monospace",letterSpacing:'.08em',textTransform:'uppercase',textAlign:i===0?'left':'right' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {cost.rows.map((r,i) => (
            <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
              <td style={{ padding:'7px 0',fontSize:11,color:'#475569',fontFamily:"'IBM Plex Mono',monospace" }}>{r.label}</td>
              <td style={{ padding:'7px 0',textAlign:'right',fontSize:11,color:'#475569',fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(r.each)}</td>
              <td style={{ padding:'7px 0',textAlign:'right',fontSize:11,color:'#475569',fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(r.tot)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop:10,padding:12,background:'#2B3990',borderRadius:6 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
          <span style={{ fontSize:11,color:'rgba(255,255,255,.75)',fontFamily:"'IBM Plex Mono',monospace" }}>Full Cost / {cost.unitLabel}</span>
          <span style={{ fontSize:17,color:'#fff',fontFamily:"'DM Serif Display',Georgia,serif" }}>KES {fmt(cost.fullEach)}</span>
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:3 }}>
          <span style={{ fontSize:10,color:'rgba(255,255,255,.45)',fontFamily:"'IBM Plex Mono',monospace" }}>Total ({cost.qtyLabel})</span>
          <span style={{ fontSize:11,color:'rgba(255,255,255,.7)',fontFamily:"'IBM Plex Mono',monospace" }}>KES {fmt(cost.fullTot)}</span>
        </div>
      </div>

      <div style={{ marginTop:13 }}>
        <div style={{ fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:7,fontFamily:"'IBM Plex Mono',monospace" }}>Pricing Reference</div>
        {[{label:`Floor (${100-rates.margin_floor}% cost)`,val:cost.floorEach,bg:'#fff7ed',border:'#fed7aa',text:'#c2410c'},{label:`Target (${rates.margin_target}% margin)`,val:cost.targetEach,bg:'#f0fdf4',border:'#bbf7d0',text:'#15803d'}].map(r=>(
          <div key={r.label} style={{ display:'flex',justifyContent:'space-between',padding:'7px 10px',background:r.bg,borderRadius:5,border:`1px solid ${r.border}`,marginBottom:5 }}>
            <span style={{ fontSize:10,color:r.text,fontFamily:"'IBM Plex Mono',monospace" }}>{r.label}</span>
            <span style={{ fontSize:11,color:r.text,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace" }}>KES {fmt(r.val)}</span>
          </div>
        ))}
        {cost.marginPct!=null&&(
          <div style={{ display:'flex',justifyContent:'space-between',padding:'7px 10px',background:sc.bg,borderRadius:5,border:`1px solid ${sc.border}` }}>
            <span style={{ fontSize:10,color:sc.text,fontFamily:"'IBM Plex Mono',monospace" }}>Quoted margin</span>
            <span style={{ fontSize:11,color:sc.text,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace" }}>{fmt(cost.marginPct,1)}%</span>
          </div>
        )}
      </div>

      {cost.approvalRequired&&(
        <div style={{ marginTop:12,padding:10,background:'#fffbeb',border:'1.5px solid #f59e0b',borderRadius:6,display:'flex',gap:8,alignItems:'flex-start' }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:'#f59e0b',flexShrink:0,marginTop:3,animation:'pulse-dot 1.5s ease infinite' }}/>
          <div>
            <div style={{ fontSize:11,color:'#92400e',fontWeight:600,fontFamily:"'IBM Plex Mono',monospace" }}>Approval Required</div>
            <div style={{ fontSize:10,color:'#b45309',marginTop:2,lineHeight:1.5,fontFamily:"'IBM Plex Mono',monospace" }}>Price below {rates.margin_floor}% floor. CFO / MD sign-off required.</div>
          </div>
        </div>
      )}

      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:9,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5,fontFamily:"'IBM Plex Mono',monospace" }}>{isSFK?'Reel':'Qty'} Ladder (floor price)</div>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead><tr>
            <td style={{ fontSize:9,color:'#94a3b8',fontFamily:"'IBM Plex Mono',monospace",paddingBottom:3 }}>Qty</td>
            <td style={{ fontSize:9,color:'#94a3b8',fontFamily:"'IBM Plex Mono',monospace",textAlign:'right',paddingBottom:3 }}>Floor/{isSFK?'reel':'pc'}</td>
          </tr></thead>
          <tbody>
            {ladderQtys.map(q => {
              const c2 = isSFK
                ? computeSFKCost({ ...form, sfkQty:String(q), sfkSellingPrice:0 }, rates)
                : computeCartonCost({ ...form, style, board, qty:q, sellingPrice:0 }, rates)
              if (!c2) return null
              const isCur = q === curQty
              return (
                <tr key={q} style={{ background:isCur?'#f0f4ff':'transparent' }}>
                  <td style={{ padding:'4px 0',fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:isCur?'#2B3990':'#64748b',fontWeight:isCur?600:400 }}>{q.toLocaleString()} {isSFK?'reels':'pcs'}</td>
                  <td style={{ padding:'4px 0',textAlign:'right',fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:isCur?'#2B3990':'#64748b',fontWeight:isCur?600:400 }}>KES {fmt(c2.floorEach)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── SIMPLE CHECK NOTE ─────────────────────────────────────── */}
      {!isSFK && cost?.blankLmm && (() => {
        const wtKgPerPc = cost.rows[0] && cost.blankSqm
          ? parseFloat(cost.blankSqm) * 437.5 / 1000  // approx from blank area
          : null
        // Better: derive from board material row (matEach / board.price * 1000)
        // Use the blankSqm directly for weight estimation
        const sc = simpleCheckFromWeight({
          wtKgPerPc: parseFloat(cost.blankSqm) * 437.5 / 1000,
          areaSqm:   parseFloat(cost.blankSqm),
          inkColours: form.inkColours,
          ply:        form.ply,
        }, rates)
        if (!sc) return null
        return (
          <div style={{ marginTop:16, padding:'10px 12px', background:'#fafafa', border:'1px dashed #cbd5e1', borderRadius:6 }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:7, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Simple Check (Excel model)</span>
              <span style={{ fontSize:8, background:'#f1f5f9', padding:'1px 6px', borderRadius:10, color:'#94a3b8' }}>ref only · not for approval</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#64748b' }}>Cost price</span>
              <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569', fontWeight:600 }}>KES {fmt(sc.costPrice)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#64748b' }}>Target ({sc.marginPct}% margin)</span>
              <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#2B3990', fontWeight:700 }}>KES {fmt(sc.targetPrice)}</span>
            </div>
            {/* Delta vs detailed model */}
            {(() => {
              const delta = cost.fullEach - sc.costPrice
              const deltaPct = sc.costPrice > 0 ? (delta / sc.costPrice * 100) : 0
              const isHigher = delta > 0
              return (
                <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color: Math.abs(deltaPct) > 20 ? '#b45309' : '#64748b', paddingTop:5, borderTop:'1px solid #f1f5f9' }}>
                  Detailed model is {isHigher ? '+' : ''}{fmt(deltaPct,1)}% {isHigher?'higher':'lower'} than Simple Check
                </div>
              )
            })()}
          </div>
        )
      })()}
    </div>
  )
}
