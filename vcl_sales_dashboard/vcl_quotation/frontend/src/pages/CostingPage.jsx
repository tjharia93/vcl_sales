// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — COSTING PAGE (clean, no ternary JSX issues)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useCosting } from '../context/CostingContext.jsx'
import { COSTING_DEFAULTS } from '../data/costingDefaults.js'
import { fmt } from '../components/UI.jsx'

const BLUE  = '#2B3990'
const MONO  = "'IBM Plex Mono',monospace"
const SERIF = "'DM Serif Display',Georgia,serif"

// ── PIN LOCK ──────────────────────────────────────────────────────────────────
function PINLock({ onUnlock }) {
  const { rates } = useCosting()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const tap = (digit) => {
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === rates.costing_pin) { onUnlock() }
      else { setError(true); setTimeout(() => { setPin(''); setError(false) }, 700) }
    }
  }
  const del = () => { setPin(p => p.slice(0, -1)); setError(false) }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 52px)', background:'#f1f5f9' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'40px 48px', boxShadow:'0 8px 40px rgba(43,57,144,.12)', textAlign:'center', minWidth:320 }}>
        <div style={{ width:52, height:52, background:'#f0f4ff', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div style={{ fontFamily:SERIF, fontSize:20, color:'#1e293b', marginBottom:6 }}>Costing Settings</div>
        <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8', marginBottom:28 }}>Enter PIN to access rates</div>
        <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:28 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width:14, height:14, borderRadius:'50%', background: pin.length > i ? (error ? '#ef4444' : BLUE) : '#e2e8f0', transition:'background .15s' }}/>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, maxWidth:240, margin:'0 auto 16px' }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'\u232b'].map((k, i) => (
            k === '' ? <div key={i}/> :
            <button key={i} onClick={() => k === '\u232b' ? del() : tap(String(k))}
              style={{ padding:'14px 0', border:'1.5px solid #e2e8f0', borderRadius:10, background:'#fff', fontFamily:MONO, fontSize:16, color:'#1e293b', cursor:'pointer', fontWeight:600 }}
            >{k}</button>
          ))}
        </div>
        {error && <div style={{ fontSize:11, fontFamily:MONO, color:'#ef4444' }}>Incorrect PIN</div>}
      </div>
    </div>
  )
}

// ── RATE ROW ──────────────────────────────────────────────────────────────────
function RateRow({ label, rateKey, unit, hint, step='1', min='0' }) {
  const { rates, updateRate } = useCosting()
  const [focused, setFocused] = useState(false)
  const val = rates[rateKey] ?? ''
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
      <div>
        <div style={{ fontSize:12, fontFamily:MONO, color:'#1e293b', fontWeight:600 }}>{label}</div>
        {hint && <div style={{ fontSize:10, fontFamily:MONO, color:'#94a3b8', marginTop:2 }}>{hint}</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input
          type="number" value={val} step={step} min={min}
          onChange={e => updateRate(rateKey, +e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width:110, padding:'7px 10px', border:`1.5px solid ${focused?BLUE:'#e2e8f0'}`, borderRadius:6, fontSize:13, fontFamily:MONO, color:'#1e293b', background:'#fff', outline:'none', textAlign:'right', boxSizing:'border-box', transition:'border-color .15s' }}
        />
        {unit && <span style={{ fontSize:11, fontFamily:MONO, color:'#64748b', minWidth:40 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ── SECTION WRAPPER ───────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:24, marginBottom:14, border:'1px solid #e2e8f0' }}>
      <div style={{ marginBottom:16, paddingBottom:10, borderBottom:'2px solid #e2e8f0' }}>
        <div style={{ fontFamily:SERIF, fontSize:15, color:'#1e293b' }}>{title}</div>
        {sub && <div style={{ fontSize:10, color:'#94a3b8', fontFamily:MONO, marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// ── DETAILED MODEL TAB ────────────────────────────────────────────────────────
function DetailedTab() {
  const { rates } = useCosting()
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div>
          <Section title="Overhead and Margins" sub="Applied to all product types">
            <RateRow label="Overhead Loading"  rateKey="overhead_pct"  unit="%" hint="Loaded on total direct cost"/>
            <RateRow label="Margin Floor"      rateKey="margin_floor"  unit="%" hint="Below this = approval required"/>
            <RateRow label="Margin Target"     rateKey="margin_target" unit="%" hint="Green zone on price status"/>
          </Section>
          <Section title="Machine Rates" sub="KES per hour">
            <RateRow label="Corrugator"       rateKey="corrugator_rate" unit="KES/hr"/>
            <RateRow label="Slotter / Scorer" rateKey="slotter_rate"    unit="KES/hr"/>
            <RateRow label="Stitcher"         rateKey="stitcher_rate"   unit="KES/hr"/>
            <RateRow label="Guillotine"       rateKey="guillotine_rate" unit="KES/hr"/>
            <RateRow label="Gluer"            rateKey="gluer_rate"      unit="KES/hr"/>
            <RateRow label="Die-Cutter"       rateKey="diecutter_rate"  unit="KES/hr"/>
          </Section>
          <Section title="Throughput and Efficiency">
            <RateRow label="Machine Efficiency"    rateKey="efficiency_pct"    unit="%"      hint="Applied to rated throughput"/>
            <RateRow label="Stitcher Throughput"   rateKey="stitcher_thru"     unit="pcs/hr" hint="At 100% efficiency"/>
            <RateRow label="SFK Corrugator Thru"   rateKey="sfk_corr_thru_sqm" unit="m2/hr" hint="SFK reel goods"/>
            <RateRow label="SFK Setup Time"        rateKey="sfk_setup_hrs"     unit="hrs"   hint="Per reel run" step="0.1"/>
          </Section>
          <Section title="Labour Rates">
            <RateRow label="Hourly Labour"   rateKey="labour_hourly"  unit="KES/hr" hint="Machine operators"/>
            <RateRow label="Piecework Rate"  rateKey="piecework_rate" unit="KES/pc" hint="Per finished piece" step="0.01"/>
          </Section>
        </div>
        <div>
          <Section title="Liner Material Prices" sub="KES per tonne, base at 90 GSM, scales with GSM">
            <RateRow label="Kraft (Virgin)"   rateKey="liner_kraft" unit="KES/t" hint="Brown, premium. Export cartons."/>
            <RateRow label="Test Liner"       rateKey="liner_test"  unit="KES/t" hint="Recycled grey. Domestic use."/>
            <RateRow label="Semi-Chemical"    rateKey="liner_semi"  unit="KES/t" hint="Mixed fibre. Standard board."/>
            <RateRow label="White-Top Kraft"  rateKey="liner_white" unit="KES/t" hint="Printable white surface."/>
          </Section>
          <Section title="Fluting Medium Prices" sub="KES per tonne, base at 90 GSM">
            <RateRow label="Medium Base Rate (90 GSM)" rateKey="medium_base" unit="KES/t" hint="Scales linearly with GSM"/>
          </Section>
          <Section title="SFK Liner Prices" sub="KES per tonne, exact price per grade">
            <RateRow label="90 GSM Kraft"  rateKey="sfk_liner_90"  unit="KES/t"/>
            <RateRow label="120 GSM Kraft" rateKey="sfk_liner_120" unit="KES/t"/>
            <RateRow label="150 GSM Kraft" rateKey="sfk_liner_150" unit="KES/t"/>
          </Section>
          <Section title="SFK Medium Prices" sub="KES per tonne, exact price per grade">
            <RateRow label="90 GSM Medium"  rateKey="sfk_medium_90"  unit="KES/t"/>
            <RateRow label="112 GSM Medium" rateKey="sfk_medium_112" unit="KES/t"/>
            <RateRow label="127 GSM Medium" rateKey="sfk_medium_127" unit="KES/t"/>
          </Section>
          <Section title="Consumables and Finishing">
            <RateRow label="Starch per Glue Line"  rateKey="starch_per_glueline"  unit="KES/m2" hint="Per m2 per glue line" step="0.001"/>
            <RateRow label="SFK Starch"            rateKey="sfk_starch_per_sqm"   unit="KES/m2" step="0.01"/>
            <RateRow label="Ink per Colour"        rateKey="ink_per_colour"        unit="KES/pc" hint="Added per ink colour"/>
            <RateRow label="Ink Base Setup"        rateKey="ink_base"              unit="KES/pc" hint="Fixed when any ink used"/>
            <RateRow label="Lamination"            rateKey="lamination_per_sqm"    unit="KES/m2"/>
            <RateRow label="UV Varnish"            rateKey="uv_per_sqm"            unit="KES/m2"/>
            <RateRow label="Die-Cut per piece"     rateKey="diecut_per_pc"         unit="KES/pc"/>
          </Section>
        </div>
      </div>
      <div style={{ background:BLUE, borderRadius:10, padding:'16px 24px', marginTop:4 }}>
        <div style={{ fontSize:9, fontFamily:MONO, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Live Rate Summary</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
          {[
            ['Overhead',      rates.overhead_pct  + '%'],
            ['Floor Margin',  rates.margin_floor  + '%'],
            ['Target Margin', rates.margin_target + '%'],
            ['Slotter',       'KES ' + Number(rates.slotter_rate).toLocaleString()  + '/hr'],
            ['Labour',        'KES ' + Number(rates.labour_hourly).toLocaleString() + '/hr'],
            ['Efficiency',    rates.efficiency_pct + '%'],
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{ fontSize:9, fontFamily:MONO, color:'rgba(255,255,255,.45)', marginBottom:3 }}>{k}</div>
              <div style={{ fontSize:13, fontFamily:SERIF, color:'#fff' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SIMPLE CHECK TAB ──────────────────────────────────────────────────────────
function SimpleCheckTab() {
  const { rates } = useCosting()

  const boardTypes = [
    { key:'sc_kg_tl',       code:'TL-TL-TL',        name:'Test Liner (3-ply)'          },
    { key:'sc_kg_sm_tl',    code:'SM-TL-TL',         name:'Semi Kraft / Test Liner'      },
    { key:'sc_kg_wtl',      code:'WTL-TL-TL',        name:'White Top Liner / TL'         },
    { key:'sc_kg_sm_tl_sm', code:'SM-TL-SM',         name:'Semi Kraft / TL / Semi Kraft' },
    { key:'sc_kg_full_sm',  code:'SM-SM-SM',         name:'Full Semi Kraft'              },
    { key:'sc_kg_k_tl',     code:'K-TL-TL',          name:'Kraft / Test Liner'           },
    { key:'sc_kg_k_tl_k',   code:'K-TL-K',           name:'Kraft / TL / Kraft'           },
    { key:'sc_kg_full_k',   code:'K-K-K',            name:'Full Kraft'                   },
    { key:'sc_kg_wk',       code:'WK-TL-K',          name:'White Kraft / TL / Kraft'     },
    { key:'sc_kg_tl_5ply',  code:'TL-TL-TL-TL-TL',  name:'Test Liner (5-ply)'           },
    { key:'sc_kg_wtl_5ply', code:'WTL-TL-TL-TL-TL', name:'White TL (5-ply)'             },
  ]

  const margins = [
    { key:'sc_margin_0col', label:'0 colours - Plain' },
    { key:'sc_margin_1col', label:'1 colour'          },
    { key:'sc_margin_2col', label:'2 colours'         },
    { key:'sc_margin_3col', label:'3 colours'         },
    { key:'sc_margin_4col', label:'4 colours'         },
    { key:'sc_margin_5col', label:'5 colours'         },
    { key:'sc_margin_6col', label:'6 colours'         },
  ]

  return (
    <div>
      <div style={{ padding:'12px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, marginBottom:20 }}>
        <div style={{ fontSize:11, fontFamily:MONO, color:'#92400e', lineHeight:1.6 }}>
          <strong>Simple Check - cross-reference only.</strong> Uses a blended KES/KG price for finished board x weight per piece plus waste percent plus flat labour. Does not drive approvals. Used to compare against the detailed model and calibrate it over time.
        </div>
        <div style={{ fontSize:10, fontFamily:MONO, color:'#b45309', marginTop:5 }}>
          Formula: (weight x KG price) x (1 + waste%) + labour = cost price. Then: cost price / (1 - margin%) = target price.
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Section title="Board Type Prices" sub="KES per KG of finished board, blended all layers">
          {boardTypes.map(bt => (
            <RateRow key={bt.key} label={bt.name} rateKey={bt.key} unit="KES/kg" hint={bt.code}/>
          ))}
        </Section>
        <div>
          <Section title="Labour and Waste" sub="Applied to every carton">
            <RateRow label="Labour plus Stitching flat" rateKey="sc_labour_per_pc" unit="KES/pc" hint="Per finished piece" step="0.5"/>
            <RateRow label="Waste Allowance"            rateKey="sc_waste_pct"     unit="%"      hint="Loaded on paper cost"/>
          </Section>
          <Section title="Target Margin by Colours" sub="Used to derive Simple Check target price">
            {margins.map(m => (
              <RateRow key={m.key} label={m.label} rateKey={m.key} unit="%"/>
            ))}
          </Section>
        </div>
      </div>
      <div style={{ background:BLUE, borderRadius:10, padding:'16px 24px', marginTop:4 }}>
        <div style={{ fontSize:9, fontFamily:MONO, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>
          Target Price Preview - example 0.38 kg/pc carton, 2 colours
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {boardTypes.slice(0, 4).map(bt => {
            const kg     = rates[bt.key] || 0
            const paper  = 0.38 * kg
            const cost   = paper * (1 + (rates.sc_waste_pct || 10) / 100) + (rates.sc_labour_per_pc || 8)
            const margin = (rates.sc_margin_2col || 30) / 100
            const target = cost / (1 - margin)
            return (
              <div key={bt.key}>
                <div style={{ fontSize:8, fontFamily:MONO, color:'rgba(255,255,255,.45)', marginBottom:2 }}>{bt.code}</div>
                <div style={{ fontSize:14, fontFamily:SERIF, color:'#fff' }}>KES {Number(target).toFixed(2)}</div>
                <div style={{ fontSize:8, fontFamily:MONO, color:'rgba(255,255,255,.35)', marginTop:1 }}>cost KES {Number(cost).toFixed(2)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export function CostingPage() {
  const { rates, updateRate, resetToDefaults } = useCosting()
  const [unlocked,  setUnlocked]  = useState(false)
  const [activeTab, setActiveTab] = useState('detailed')
  const [showReset, setShowReset] = useState(false)
  const [pinChange, setPinChange] = useState({ show:false, step:1, newPin:'', confirm:'' })

  if (!unlocked) return <PINLock onUnlock={() => setUnlocked(true)}/>

  const doReset = () => { resetToDefaults(); setShowReset(false) }

  return (
    <div style={{ background:'#f1f5f9', minHeight:'calc(100vh - 52px)' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:24 }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:SERIF, fontSize:22, color:'#1e293b' }}>Costing Settings</div>
            <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8', marginTop:3 }}>All changes save automatically and apply immediately to the quote form.</div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setPinChange({ show:true, step:1, newPin:'', confirm:'' })}
              style={{ padding:'9px 16px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:7, fontSize:11, fontFamily:MONO, cursor:'pointer', color:'#64748b' }}>
              Change PIN
            </button>
            <button onClick={() => setShowReset(true)}
              style={{ padding:'9px 16px', border:'1.5px solid #fecaca', background:'#fef2f2', borderRadius:7, fontSize:11, fontFamily:MONO, cursor:'pointer', color:'#b91c1c' }}>
              Reset to Defaults
            </button>
            <button onClick={() => setUnlocked(false)}
              style={{ padding:'9px 16px', border:'none', background:BLUE, borderRadius:7, fontSize:11, fontFamily:MONO, cursor:'pointer', color:'#fff', fontWeight:600 }}>
              Lock
            </button>
          </div>
        </div>

        <div style={{ display:'flex', background:'#e2e8f0', borderRadius:8, padding:3, marginBottom:20, width:'fit-content' }}>
          {[['detailed','Detailed Model'],['simple','Simple Check']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding:'8px 20px', border:'none', borderRadius:6, cursor:'pointer',
              fontFamily:MONO, fontSize:11, fontWeight:600, transition:'all .15s',
              background: activeTab === id ? BLUE : 'transparent',
              color:      activeTab === id ? '#fff' : '#64748b',
              boxShadow:  activeTab === id ? '0 2px 8px rgba(43,57,144,.3)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {activeTab === 'detailed' && <DetailedTab/>}
        {activeTab === 'simple'   && <SimpleCheckTab/>}

      </div>

      {showReset && (
        <div onClick={() => setShowReset(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:32, maxWidth:380, textAlign:'center', boxShadow:'0 16px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontFamily:SERIF, fontSize:18, color:'#1e293b', marginBottom:10 }}>Reset to Defaults?</div>
            <div style={{ fontSize:12, fontFamily:MONO, color:'#64748b', lineHeight:1.6, marginBottom:24 }}>This will overwrite all current rates. Cannot be undone.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowReset(false)} style={{ padding:'10px 20px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:7, fontSize:12, fontFamily:MONO, cursor:'pointer', color:'#64748b' }}>Cancel</button>
              <button onClick={doReset} style={{ padding:'10px 20px', background:'#ef4444', border:'none', borderRadius:7, fontSize:12, fontFamily:MONO, cursor:'pointer', color:'#fff', fontWeight:600 }}>Reset All Rates</button>
            </div>
          </div>
        </div>
      )}

      {pinChange.show && (
        <div onClick={() => setPinChange(p => ({ ...p, show:false }))} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:32, maxWidth:360, boxShadow:'0 16px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontFamily:SERIF, fontSize:18, color:'#1e293b', marginBottom:6 }}>
              {pinChange.step === 1 ? 'Enter New PIN' : 'Confirm New PIN'}
            </div>
            <div style={{ fontSize:11, fontFamily:MONO, color:'#94a3b8', marginBottom:20 }}>4-digit PIN</div>
            <input
              type="password" maxLength={4} inputMode="numeric"
              value={pinChange.step === 1 ? pinChange.newPin : pinChange.confirm}
              onChange={e => {
                const v = e.target.value.replace(/\D/g,'').slice(0,4)
                setPinChange(p => p.step === 1 ? { ...p, newPin:v } : { ...p, confirm:v })
              }}
              style={{ width:'100%', padding:'12px', border:`1.5px solid ${BLUE}`, borderRadius:8, fontSize:18, fontFamily:MONO, textAlign:'center', letterSpacing:8, outline:'none', boxSizing:'border-box', marginBottom:16 }}
              autoFocus
            />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setPinChange(p => ({ ...p, show:false }))}
                style={{ flex:1, padding:'10px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:7, fontSize:12, fontFamily:MONO, cursor:'pointer', color:'#64748b' }}>Cancel</button>
              <button onClick={() => {
                if (pinChange.step === 1) {
                  if (pinChange.newPin.length === 4) setPinChange(p => ({ ...p, step:2 }))
                } else {
                  if (pinChange.confirm === pinChange.newPin) {
                    updateRate('costing_pin', pinChange.newPin)
                    setPinChange({ show:false, step:1, newPin:'', confirm:'' })
                  } else {
                    setPinChange(p => ({ ...p, confirm:'', step:1 }))
                  }
                }
              }} style={{ flex:1, padding:'10px', background:BLUE, border:'none', borderRadius:7, fontSize:12, fontFamily:MONO, cursor:'pointer', color:'#fff', fontWeight:600 }}>
                {pinChange.step === 1 ? 'Next' : 'Save PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
