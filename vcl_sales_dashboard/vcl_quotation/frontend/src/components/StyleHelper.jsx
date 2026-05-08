import { STYLE_HELPERS, COMPLEXITY_COLORS } from '../data/masterData.js'
import { FlatLayout } from './Diagrams.jsx'

export function StyleHelper({ styleCode, dimL, dimW, dimH, blankLmm, blankWmm }) {
  const h = STYLE_HELPERS[styleCode]
  if (!h) return null
  const cColor = COMPLEXITY_COLORS[h.complexity] || '#64748b'

  return (
    <div style={{ marginTop:14, background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:8, overflow:'hidden', animation:'slide-up .2s ease' }}>
      <div style={{ background:'#2B3990', padding:'9px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, fontFamily:"'DM Serif Display',Georgia,serif", color:'#fff' }}>{h.title}</span>
        <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'rgba(255,255,255,.55)' }}>{h.fefco}</span>
      </div>

      {/* Flat blank layout diagram */}
      <div style={{ padding:'14px 16px', background:'#fff', borderBottom:'1px solid #e2e8f0' }}>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>
          Flat Blank Layout {dimL&&dimW&&dimH ? `— Live (${dimL}×${dimW}×${dimH}mm)` : '— Example Dimensions'}
        </div>
        <FlatLayout styleCode={styleCode} dimL={dimL||355} dimW={dimW||265} dimH={dimH||200} blankLmm={blankLmm} blankWmm={blankWmm}/>
      </div>

      {/* Info */}
      <div style={{ padding:'12px 14px' }}>
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Typical Uses</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {h.uses.map(u => <span key={u} style={{ padding:'2px 8px', borderRadius:12, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", background:'#eff3ff', border:'1px solid #c7d2fe', color:'#4338ca' }}>{u}</span>)}
          </div>
        </div>
        <div style={{ marginBottom:8, padding:'7px 9px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:6 }}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Blank Size Logic</div>
          <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#475569', lineHeight:1.5 }}>{h.blankNote}</div>
        </div>
        <div style={{ marginBottom:8, padding:'7px 9px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6 }}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#92400e', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Dimension Impact</div>
          <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#78350f', lineHeight:1.5 }}>{h.sizeImpact}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Production Route</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {h.stations.map((s,i) => (
                <span key={i} style={{ display:'flex', alignItems:'center', gap:3 }}>
                  <span style={{ padding:'2px 7px', background:'#f0f4ff', border:'1px solid #2B3990', borderRadius:4, fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#2B3990' }}>{s}</span>
                  {i < h.stations.length-1 && <span style={{ color:'#94a3b8', fontSize:9 }}>→</span>}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Complexity</div>
            <span style={{ padding:'2px 9px', borderRadius:12, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, background:`${cColor}18`, color:cColor, border:`1px solid ${cColor}44` }}>{h.complexity}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
