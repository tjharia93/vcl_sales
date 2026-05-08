// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — FLAT BLANK LAYOUT DIAGRAMS  (clean, scaled, readable)
// ─────────────────────────────────────────────────────────────────────────────

const BLUE   = '#2B3990'
const RED    = '#ED1C24'
const LIGHT  = '#eef1fa'
const ACCENT = '#d0d8f0'
const DIM    = '#64748b'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Compute a scale factor so the whole blank fits within maxPx wide
function autoScale(cols, maxPx = 480) {
  const total = cols.reduce((a, b) => a + b, 0)
  return Math.min(1, maxPx / total)
}

// A single labelled panel
function Panel({ x, y, w, h, label, dim, shade }) {
  const fs  = Math.max(7, Math.min(11, w * 0.18))   // font scales with panel width
  const fs2 = Math.max(6, fs - 2)
  return (
    <g>
      <rect x={x+0.5} y={y+0.5} width={Math.max(w-1,1)} height={Math.max(h-1,1)}
        fill={shade ? ACCENT : LIGHT} stroke={BLUE} strokeWidth={1} rx={2}/>
      <text x={x+w/2} y={y+h/2 - (dim ? fs2*0.6 : 0)}
        textAnchor="middle" dominantBaseline="middle"
        fill={BLUE} fontSize={fs} fontFamily="IBM Plex Mono" fontWeight={600}>{label}</text>
      {dim && (
        <text x={x+w/2} y={y+h/2 + fs*0.7}
          textAnchor="middle" dominantBaseline="middle"
          fill={DIM} fontSize={fs2} fontFamily="IBM Plex Mono">{dim}</text>
      )}
    </g>
  )
}

// A dimension tick under the blank
function Tick({ x, y, w, label }) {
  const cx = x + w / 2
  return (
    <g>
      <line x1={x} y1={y} x2={x+w} y2={y} stroke={RED} strokeWidth={0.8}/>
      <line x1={x}   y1={y-3} x2={x}   y2={y+3} stroke={RED} strokeWidth={0.8}/>
      <line x1={x+w} y1={y-3} x2={x+w} y2={y+3} stroke={RED} strokeWidth={0.8}/>
      <text x={cx} y={y+9} textAnchor="middle" fill={RED} fontSize={7.5} fontFamily="IBM Plex Mono">{label}</text>
    </g>
  )
}

// A stitch dot
function Dot({ x, y }) {
  return <circle cx={x} cy={y} r={3.5} fill={RED} opacity={0.9}/>
}

// ── RSC / HSC / FOL / OSC family ──────────────────────────────────────────────
// Layout: Tab | Side | Front | Side | Back  (columns)
//         Top flap row / Main row / Bottom flap row
function RSCLayout({ L, W, H, variant='rsc' }) {
  const flapH  = Math.round(W / 2)   // standard flap = W/2
  const tabW   = 30
  // raw panel widths in mm: [tab, side, front, side, back]
  const rawCols = [tabW, W, L, W, L]
  const rawRows = variant === 'hsc'
    ? [0, H, flapH]          // HSC: no top flap, only bottom
    : [flapH, H, flapH]

  const PAD  = 32   // left/right padding px
  const sc   = autoScale(rawCols, 460)
  const cols = rawCols.map(v => Math.max(Math.round(v * sc), 18))
  const rows = rawRows.map(v => Math.max(Math.round(v * sc), v > 0 ? 14 : 0))

  const OX = PAD, OY = 12
  // cumulative x positions
  const cx = [OX]; cols.forEach((w, i) => cx.push(cx[i] + w))
  // cumulative y positions
  const ry = [OY]; rows.forEach((h, i) => ry.push(ry[i] + h))

  const blankW = 2*(L+W) + tabW + 40
  const blankH = rawRows.reduce((a, b) => a + b, 0)
  const TICK_Y = OY + rows.reduce((a, b) => a + b, 0) + 14
  const svgW   = OX + cols.reduce((a, b) => a + b, 0) + PAD
  const svgH   = TICK_Y + 24

  const colLabels = ['Tab', 'Side', 'Front', 'Side', 'Back']
  const colDims   = [tabW, W, L, W, L]

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display:'block', maxWidth:'100%' }}>
      {/* Top flap row */}
      {rows[0] > 0 && cols.map((cw, ci) => (
        <Panel key={`t${ci}`} x={cx[ci]} y={ry[0]} w={cw} h={rows[0]}
          label={ci===0?'':'Top'} dim="" shade={ci===0}/>
      ))}
      {/* Main row */}
      {cols.map((cw, ci) => (
        <Panel key={`m${ci}`} x={cx[ci]} y={ry[1]} w={cw} h={rows[1]}
          label={colLabels[ci]}
          dim={`${colDims[ci]}`}
          shade={ci===0}/>
      ))}
      {/* Bottom flap row */}
      {rows[2] > 0 && cols.map((cw, ci) => (
        <Panel key={`b${ci}`} x={cx[ci]} y={ry[2]} w={cw} h={rows[2]}
          label={ci===0?'':'Btm'} dim="" shade={ci===0}/>
      ))}
      {/* Stitch dots on side panels (ci=1 and ci=3) */}
      {[1, 3].map(ci => (
        <g key={`dot${ci}`}>
          <Dot x={cx[ci] + cols[ci]/2} y={ry[1]}/>
          <Dot x={cx[ci] + cols[ci]/2} y={ry[2]}/>
        </g>
      ))}
      {/* Dimension ticks */}
      {cols.map((cw, ci) => (
        <Tick key={`tk${ci}`} x={cx[ci]} y={TICK_Y} w={cw} label={`${colDims[ci]}`}/>
      ))}
      {/* Blank total */}
      <text x={OX} y={svgH - 2} fill={DIM} fontSize={8} fontFamily="IBM Plex Mono">
        {`Blank: ${blankW}mm × ${blankH}mm`}
      </text>
    </svg>
  )
}

// ── TRAY family ───────────────────────────────────────────────────────────────
// Cross-shaped blank: centre base, end panels each side, side panels top/bottom
function TrayLayout({ L, W, H, flaps = 2 }) {
  const PAD = 28
  const sc  = autoScale([H, L, H], 460)
  const eW  = Math.max(Math.round(H * sc), 16)   // end panel width
  const bW  = Math.max(Math.round(L * sc), 24)   // base width
  const bH  = Math.max(Math.round(W * sc), 20)   // base height
  const sH  = Math.max(Math.round(H * sc), 14)   // side panel height
  const fH  = flaps > 0 ? Math.max(Math.round(H * sc * 0.45), 10) : 0

  const OX  = PAD + eW
  const OY  = PAD + sH + fH
  const svgW = PAD + eW + bW + eW + PAD
  const svgH = OY + bH + sH + fH + 28

  const TICK_Y = OY + bH + sH + fH + 12

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display:'block', maxWidth:'100%' }}>
      {/* Base */}
      <Panel x={OX} y={OY} w={bW} h={bH} label="Base" dim={`${L}×${W}`}/>
      {/* End panels */}
      <Panel x={OX - eW} y={OY} w={eW} h={bH} label="End" dim={`${H}`} shade/>
      <Panel x={OX + bW} y={OY} w={eW} h={bH} label="End" dim={`${H}`} shade/>
      {/* Top side panel */}
      <Panel x={OX} y={OY - sH} w={bW} h={sH} label="Side" dim={`${H}`} shade/>
      {/* Bottom side panel */}
      {flaps >= 1 && <Panel x={OX} y={OY + bH} w={bW} h={sH} label="Side" dim={`${H}`} shade/>}
      {/* Flap extensions */}
      {flaps >= 1 && <Panel x={OX} y={OY - sH - fH} w={bW} h={fH} label="Flap" dim=""/>}
      {flaps >= 2 && <Panel x={OX} y={OY + bH + sH} w={bW} h={fH} label="Flap" dim=""/>}
      {/* Stitch dots at corners of base */}
      <Dot x={OX}      y={OY}/><Dot x={OX+bW} y={OY}/>
      <Dot x={OX}      y={OY+bH}/><Dot x={OX+bW} y={OY+bH}/>
      {/* Ticks */}
      <Tick x={OX-eW} y={TICK_Y} w={eW} label={`${H}`}/>
      <Tick x={OX}    y={TICK_Y} w={bW} label={`${L}`}/>
      <Tick x={OX+bW} y={TICK_Y} w={eW} label={`${H}`}/>
      {/* Blank total */}
      <text x={PAD} y={svgH-2} fill={DIM} fontSize={8} fontFamily="IBM Plex Mono">
        {`Blank: ${L+2*H+40}mm × ${W+2*H+(flaps>0?H*0.45*2:0)|0}mm`}
      </text>
    </svg>
  )
}

// ── Generic sheet ─────────────────────────────────────────────────────────────
function SheetLayout({ blankL, blankW, label = 'Blank Sheet' }) {
  const sc = Math.min(1, 420 / blankL, 120 / blankW)
  const pw = Math.round(blankL * sc)
  const ph = Math.round(blankW * sc)
  const OX = 20, OY = 12
  return (
    <svg viewBox={`0 0 ${pw+60} ${ph+40}`} width="100%" style={{ display:'block', maxWidth:'100%' }}>
      <rect x={OX} y={OY} width={pw} height={ph} fill={LIGHT} stroke={BLUE} strokeWidth={1} rx={2}/>
      <text x={OX+pw/2} y={OY+ph/2} textAnchor="middle" dominantBaseline="middle"
        fill={BLUE} fontSize={10} fontFamily="IBM Plex Mono" fontWeight={600}>{label}</text>
      <Tick x={OX} y={OY+ph+12} w={pw} label={`${blankL}mm`}/>
      <text x={OX+pw+8} y={OY+ph/2} textAnchor="start" dominantBaseline="middle"
        fill={RED} fontSize={8} fontFamily="IBM Plex Mono">{blankW}mm</text>
    </svg>
  )
}

// ── PUBLIC COMPONENT ──────────────────────────────────────────────────────────
export function FlatLayout({ styleCode, dimL, dimW, dimH, blankLmm, blankWmm }) {
  const L = +dimL || 355, W = +dimW || 265, H = +dimH || 200

  const RSC_FAMILY = ['RSC','2RSC','3RSC','FOL','OSC','TELE_BASE','TELE_LID','WRAPAROUND','CRASH_LOCK']
  const TRAY_FLAPS = { FLAT_TRAY:0, '1FLAP_TRAY':1, '2FLAP_TRAY':2 }

  if (RSC_FAMILY.includes(styleCode)) return <RSCLayout L={L} W={W} H={H} variant="rsc"/>
  if (styleCode === 'HSC')            return <RSCLayout L={L} W={W} H={H} variant="hsc"/>
  if (styleCode in TRAY_FLAPS)        return <TrayLayout L={L} W={W} H={H} flaps={TRAY_FLAPS[styleCode]}/>
  return <SheetLayout blankL={blankLmm||L} blankW={blankWmm||W} label={styleCode?.replace(/_/g,' ')||'Blank'}/>
}
