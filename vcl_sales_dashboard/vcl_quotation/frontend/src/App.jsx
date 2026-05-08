import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useCosting } from './context/CostingContext.jsx'
import { CostingPage } from './pages/CostingPage.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { apiSaveQuote } from './api/quotes.js'
import {
  CARTON_STYLES, STYLE_GROUPS, STATUS_CONFIG,
  LINER_TYPES, FLUTE_TYPES,
  PLY_LAYERS, defaultLayers, linerPrice,
  SFK_LINERS, SFK_MEDIUMS, SFK_FLUTES,
  MARGIN_FLOOR, MARGIN_TARGET,
} from './data/masterData.js'
import { buildBoard, computeCartonCost, computeSFKCost } from './engine/costing.js'
import { StyleHelper } from './components/StyleHelper.jsx'
import { CostPanel } from './components/CostPanel.jsx'
import { PrintModal } from './components/PrintModal.jsx'
import {
  SectionHeader, FieldLabel, TextInput, SelectInput,
  Toggle, PlyButton, Card, InfoStrip,
  fmt, genRef, fetchNextRef, GRID,
} from './components/UI.jsx'

// ─── DEFAULT FORM STATE ───────────────────────────────────────────────────────
function defaultPreparedBy() {
  if (typeof window === 'undefined') return ''
  const sess = window.frappe && window.frappe.session
  if (!sess) return ''
  return sess.user_fullname || sess.user || ''
}

function makeBlank() {
  return {
    quoteRef:    genRef(),
    productType: 'carton',
    preparedBy:defaultPreparedBy(), customer:'', productDesc:'', validUntil:'', paymentTerms:'30 days net', remarks:'',
    // Carton
    styleCode:'', ply:'3', fluteCode:'B',
    // Per-part GSM/type — seeded from PLY_LAYERS defaults
    ...defaultLayers('3'),
    dimL:'', dimW:'', dimH:'', qty:'',
    inkColours:0, hasLam:false, hasDieCut:false, hasUV:false,
    labourType:'hourly', sellingPrice:'',
    // SFK
    sfkWidth:'', sfkMetres:'', sfkQty:'',
    sfkLiner:'K120', sfkMedium:'M112', sfkFlute:'B',
    sfkSellingPrice:'',
    sfkApplication:'', sfkCore:'76mm',
    // UI
    showModal: false,
  }
}

export default function App() {
  const [form, setForm] = useState(makeBlank)
  const [page, setPage] = useState('quote')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [costOpen, setCostOpen] = useState(false)   // mobile bottom-sheet toggle
  const { rates } = useCosting()
  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), [])

  // On first load, replace the random ref with a sequential one from the API.
  // Use a ref guard to prevent StrictMode double-invoke consuming two numbers.
  const refFetched = useRef(false)
  useEffect(() => {
    if (refFetched.current) return
    refFetched.current = true
    fetchNextRef().then(ref => setForm(f => ({ ...f, quoteRef: ref })))
  }, [])

  const handleNewRef = useCallback(async () => {
    const ref = await fetchNextRef()
    set('quoteRef', ref)
  }, [set])

  const isSFK  = form.productType === 'sfk'
  const style  = useMemo(() => CARTON_STYLES.find(s => s.code === form.styleCode), [form.styleCode])
  const board  = useMemo(() => isSFK ? null : buildBoard(form, rates), [form, isSFK, rates])
  const layers = useMemo(() => PLY_LAYERS[form.ply] || PLY_LAYERS['3'], [form.ply])
  const availableFlutes = useMemo(() => FLUTE_TYPES.filter(f => form.ply === '5' || f.thick3 != null), [form.ply])

  // Ply change: reset BC/EB flute + re-seed layer defaults
  const handlePly = useCallback((p) => {
    const fl = form.fluteCode
    const invalid = (fl === 'BC' || fl === 'EB') && p === '3'
    setForm(f => ({
      ...f,
      ply: p,
      fluteCode: invalid ? 'B' : f.fluteCode,
      ...defaultLayers(p),
    }))
  }, [form.fluteCode])

  // Compute cost — SFK uses its own engine, carton uses board
  const cost = useMemo(() => {
    if (isSFK) return computeSFKCost(form, rates)
    return computeCartonCost({ ...form, style, board }, rates)
  }, [form, isSFK, style, board, rates])

  const sc = cost ? STATUS_CONFIG[cost.priceStatus] : STATUS_CONFIG.unset

  // Save current quote to API (defined after cost is computed)
  const handleSave = useCallback(async () => {
    if (!cost) return
    setSaving(true); setSaveMsg(null)
    try {
      await apiSaveQuote({
        ...form,
        marginPct:   cost.marginPct,
        priceStatus: cost.priceStatus,
      })
      setSaveMsg({ type:'ok', text:'Saved' })
      setTimeout(() => setSaveMsg(null), 2500)
    } catch (e) {
      setSaveMsg({ type:'err', text:'Save failed — is the API running?' })
      setTimeout(() => setSaveMsg(null), 4000)
    } finally {
      setSaving(false)
    }
  }, [form, cost])

  // Re-open a saved quote from the dashboard
  const handleOpenFromDashboard = useCallback((savedForm) => {
    setForm({ ...savedForm, showModal: false })
    setPage('quote')
  }, [])

  const clearForm = useCallback(async () => {
    const ref = await fetchNextRef()
    setForm({ ...makeBlank(), productType: form.productType, quoteRef: ref })
  }, [form.productType])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f1f5f9;font-family:'IBM Plex Mono',monospace;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#f1f5f9;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.5);}}
        @keyframes slide-up{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        select optgroup{font-weight:600;color:#2B3990;}

        /* Mobile responsive layout (QUOT-001) */
        .q-topbar{padding:0 24px;}
        .q-topbar__title{display:flex;flex-direction:column;}
        .q-topbar__ref{display:inline;}
        .q-cost-toggle{display:none;}
        .q-main{display:grid;grid-template-columns:1fr 360px;min-height:calc(100vh - 52px);}
        .q-form-col{padding:24px;overflow-y:auto;}
        .q-cost-col{background:#fff;border-left:1px solid #e2e8f0;padding:24px 20px;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto;}
        @media (max-width: 900px){
          .q-topbar{padding:0 12px;gap:8px;}
          .q-topbar__title{display:none;}
          .q-topbar__ref{display:none;}
          .q-cost-toggle{display:inline-flex;}
          .q-main{grid-template-columns:1fr;}
          .q-form-col{padding:14px 12px 96px;}
          .q-cost-col{position:fixed;left:0;right:0;bottom:0;top:auto;height:60vh;border-left:none;border-top:2px solid #2B3990;box-shadow:0 -8px 24px rgba(15,23,42,.18);transform:translateY(100%);transition:transform .25s ease;z-index:150;border-radius:14px 14px 0 0;padding:18px 14px 24px;}
          .q-cost-col.is-open{transform:translateY(0);}
          .q-tabs button{padding:5px 10px !important;font-size:10px !important;}
        }
      `}</style>

      {/* TOP BAR */}
      <div className="q-topbar" style={{background:'#2B3990',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 12px rgba(43,57,144,.35)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:30,height:30,background:'rgba(255,255,255,.14)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div className="q-topbar__title">
            <div style={{fontSize:13,color:'#fff',fontWeight:600,letterSpacing:'.04em'}}>VCL Quotation System</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,.45)',letterSpacing:'.1em',textTransform:'uppercase'}}>Internal · Cartons &amp; SFK</div>
          </div>
        </div>
        {/* Tab navigation */}
        <div className="q-tabs" style={{display:'flex',gap:4,background:'rgba(255,255,255,.1)',borderRadius:8,padding:4}}>
          {[['quote','Quote'],['dashboard','Dashboard'],['costing','Costing']].map(([p,label])=>(
            <button key={p} onClick={()=>setPage(p)} style={{padding:'5px 14px',border:'none',borderRadius:6,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,cursor:'pointer',fontWeight:600,letterSpacing:'.04em',transition:'all .15s',background:page===p?'#fff':'transparent',color:page===p?'#2B3990':'rgba(255,255,255,.7)'}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {saveMsg&&<span style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:saveMsg.type==='ok'?'#86efac':'#fca5a5'}}>{saveMsg.text}</span>}
          {page==='quote'&&<button onClick={clearForm} style={{padding:'5px 14px',background:'rgba(255,255,255,.18)',border:'1px solid rgba(255,255,255,.35)',borderRadius:5,fontSize:10,color:'#fff',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,letterSpacing:'.04em',display:'flex',alignItems:'center',gap:5}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New
          </button>}
          {page==='quote'&&<button onClick={handleSave} disabled={!cost||saving} style={{padding:'5px 14px',background:cost&&!saving?'rgba(255,255,255,.18)':'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.25)',borderRadius:5,fontSize:10,color:cost&&!saving?'#fff':'rgba(255,255,255,.35)',cursor:cost&&!saving?'pointer':'not-allowed',fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,transition:'all .15s'}}>{saving?'Saving...':'Save Quote'}</button>}
          <span className="q-topbar__ref" style={{fontSize:10,color:'rgba(255,255,255,.5)'}}>{form.quoteRef}</span>
          <button onClick={handleNewRef} className="q-topbar__ref" style={{padding:'4px 10px',background:'rgba(255,255,255,.12)',border:'none',borderRadius:4,fontSize:10,color:'rgba(255,255,255,.7)',cursor:'pointer',fontFamily:"'IBM Plex Mono',monospace"}}>New Ref</button>
        </div>
      </div>

      {/* Page routing */}
      {page==='dashboard' ? <Dashboard onOpenQuote={handleOpenFromDashboard}/> :
       page==='costing'   ? <CostingPage/> : <div className="q-main">
        <div className="q-form-col">

          {/* Product type switcher */}
          <div style={{display:'flex',background:'#e2e8f0',borderRadius:8,padding:3,marginBottom:20}}>
            {[['carton','Corrugated Carton'],['sfk','Single Face Kraft (SFK)']].map(([val,label])=>(
              <button key={val} onClick={()=>set('productType',val)} style={{flex:1,padding:'9px 0',border:'none',borderRadius:6,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,cursor:'pointer',fontWeight:600,letterSpacing:'.04em',transition:'all .18s',background:form.productType===val?'#2B3990':'transparent',color:form.productType===val?'#fff':'#64748b',boxShadow:form.productType===val?'0 2px 8px rgba(43,57,144,.3)':'none'}}>{label}</button>
            ))}
          </div>

          {/* 01 Quote Details */}
          <Card>
            <SectionHeader number="01" title="Quote Details" sub="Reference · Customer · Validity"/>
            <div style={{...GRID.three,marginBottom:12}}>
              <FieldLabel label="Prepared By"><TextInput value={form.preparedBy} onChange={v=>set('preparedBy',v)} placeholder="Your name"/></FieldLabel>
              <FieldLabel label="Customer Name"><TextInput value={form.customer} onChange={v=>set('customer',v)} placeholder="Customer / Account"/></FieldLabel>
              <FieldLabel label="Product Description"><TextInput value={form.productDesc} onChange={v=>set('productDesc',v)} placeholder="e.g. Mango Export Tray"/></FieldLabel>
            </div>
            <div style={GRID.three}>
              <FieldLabel label="Valid Until"><TextInput type="date" value={form.validUntil} onChange={v=>set('validUntil',v)}/></FieldLabel>
              <FieldLabel label="Payment Terms">
                <SelectInput value={form.paymentTerms} onChange={v=>set('paymentTerms',v)}>
                  {['Cash on Delivery','7 days net','14 days net','30 days net','60 days net','Letter of Credit'].map(t=><option key={t} value={t}>{t}</option>)}
                </SelectInput>
              </FieldLabel>
              <FieldLabel label="Remarks"><TextInput value={form.remarks} onChange={v=>set('remarks',v)} placeholder="Optional notes"/></FieldLabel>
            </div>
          </Card>

          {/* 02 Style & Board */}
          <Card>
            <SectionHeader number="02" title={isSFK?'SFK Reel Specification':'Carton Style & Board Specification'} sub={isSFK?'Liner · Medium · Flute':'Style → Ply → Material & GSM per layer → Flute'}/>

            {isSFK ? (
              /* ── SFK SPEC ── */
              <div style={GRID.three}>
                <FieldLabel label="Kraft Liner">
                  <SelectInput value={form.sfkLiner} onChange={v=>set('sfkLiner',v)}>
                    {SFK_LINERS.map(l=><option key={l.code} value={l.code}>{l.name} · KES {(l.pricePerTonne/1000).toFixed(0)}/kg</option>)}
                  </SelectInput>
                </FieldLabel>
                <FieldLabel label="Fluting Medium">
                  <SelectInput value={form.sfkMedium} onChange={v=>set('sfkMedium',v)}>
                    {SFK_MEDIUMS.map(m=><option key={m.code} value={m.code}>{m.name} · KES {(m.pricePerTonne/1000).toFixed(0)}/kg</option>)}
                  </SelectInput>
                </FieldLabel>
                <FieldLabel label="Flute Type">
                  <SelectInput value={form.sfkFlute} onChange={v=>set('sfkFlute',v)}>
                    {SFK_FLUTES.map(f=><option key={f.code} value={f.code}>{f.name} (take-up ×{f.factor})</option>)}
                  </SelectInput>
                </FieldLabel>
              </div>
            ) : (
              /* ── CARTON SPEC ── */
              <>
                {/* Step 1: Style */}
                <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#2B3990',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:7}}>Step 1 — Carton Style</div>
                <SelectInput value={form.styleCode} onChange={v=>set('styleCode',v)}>
                  <option value="">— Select carton style —</option>
                  {Object.entries(STYLE_GROUPS).map(([cat,styles])=>(
                    <optgroup key={cat} label={cat}>
                      {styles.map(s=><option key={s.code} value={s.code}>{s.name}{s.fefco&&s.fefco!=='—'?` [FEFCO ${s.fefco}]`:''}</option>)}
                    </optgroup>
                  ))}
                </SelectInput>

                {/* Style helper with flat layout */}
                {form.styleCode && (
                  <StyleHelper styleCode={form.styleCode}
                    dimL={form.dimL} dimW={form.dimW} dimH={form.dimH}
                    blankLmm={cost?.blankLmm} blankWmm={cost?.blankWmm}
                  />
                )}

                {/* Step 2: Ply */}
                <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #f1f5f9'}}>
                  <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#2B3990',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:10}}>Step 2 — Board Construction</div>
                  <div style={{display:'flex',gap:10,marginBottom:14}}>
                    <PlyButton label="3-Ply" sub="Single wall · Standard"  active={form.ply==='3'} onClick={()=>handlePly('3')}/>
                    <PlyButton label="5-Ply" sub="Double wall · Heavy duty" active={form.ply==='5'} onClick={()=>handlePly('5')}/>
                  </div>

                  {/* Flute selector */}
                  <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#64748b',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:7}}>Flute Type</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                    {availableFlutes.map(f=>(
                      <div key={f.code} onClick={()=>set('fluteCode',f.code)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',border:`1.5px solid ${form.fluteCode===f.code?'#2B3990':'#e2e8f0'}`,borderRadius:7,cursor:'pointer',background:form.fluteCode===f.code?'#f0f4ff':'#fff',transition:'all .15s'}}>
                        <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${form.fluteCode===f.code?'#2B3990':'#cbd5e1'}`,background:form.fluteCode===f.code?'#2B3990':'transparent',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {form.fluteCode===f.code&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:form.fluteCode===f.code?'#2B3990':'#1e293b',fontWeight:form.fluteCode===f.code?600:400}}>{f.name}</div>
                          <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#94a3b8',marginTop:1}}>{f.desc}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:9,color:'#94a3b8',fontFamily:"'IBM Plex Mono',monospace"}}>Thickness</div>
                          <div style={{fontSize:12,fontFamily:"'IBM Plex Mono',monospace",color:'#1e293b',fontWeight:600}}>{form.ply==='5'?f.thick5:f.thick3}mm</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step 3: Per-part GSM */}
                  <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#2B3990',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:10}}>Step 3 — Material &amp; GSM per Layer</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {layers.map((layer,i)=>(
                      <div key={layer.key} style={{display:'grid',gridTemplateColumns:layer.role==='liner'?'2fr 1fr 1fr':'2fr 1fr',gap:10,alignItems:'end',padding:'10px 12px',background:i%2===0?'#f8fafc':'#fff',border:'1px solid #e2e8f0',borderRadius:6}}>
                        {/* Layer label */}
                        <div>
                          <div style={{fontSize:9,fontFamily:"'IBM Plex Mono',monospace",color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>{layer.label}</div>
                          <div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:'#475569'}}>
                            {layer.role==='liner' ? '↑ Liner sheet' : '≋ Fluted medium'}
                          </div>
                        </div>
                        {/* Liner type — only for liner layers */}
                        {layer.role==='liner'&&(
                          <div>
                            <div style={{fontSize:9,fontFamily:"'IBM Plex Mono',monospace",color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>Type</div>
                            <SelectInput value={form[`type_${layer.key}`]||layer.defaultType} onChange={v=>set(`type_${layer.key}`,v)}>
                              {LINER_TYPES.map(lt=><option key={lt.code} value={lt.code}>{lt.name}</option>)}
                            </SelectInput>
                          </div>
                        )}
                        {/* GSM — free text number entry */}
                        <div>
                          <div style={{fontSize:9,fontFamily:"'IBM Plex Mono',monospace",color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:3}}>GSM</div>
                          <TextInput
                            type="number" min="60" step="1"
                            value={String(form[`gsm_${layer.key}`]||layer.defaultGSM)}
                            onChange={v=>set(`gsm_${layer.key}`, v===''?layer.defaultGSM:+v)}
                            placeholder={String(layer.defaultGSM)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Computed board summary */}
                  {board&&(
                    <div style={{marginTop:12,padding:'12px 14px',background:'#2B3990',borderRadius:8,animation:'slide-up .2s ease'}}>
                      <div style={{fontSize:9,fontFamily:"'IBM Plex Mono',monospace",color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:8}}>Computed Board Specification</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                        {[['Construction',board.ply],['Flute',board.flute],['Thickness',board.thick+'mm'],['Board Cost','KES '+fmt(board.price)+'/m²']].map(([k,v])=>(
                          <div key={k}>
                            <div style={{fontSize:9,fontFamily:"'IBM Plex Mono',monospace",color:'rgba(255,255,255,.5)',marginBottom:3}}>{k}</div>
                            <div style={{fontSize:12,fontFamily:"'DM Serif Display',Georgia,serif",color:'#fff'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* 03 Dimensions */}
          <Card>
            <SectionHeader number="03" title={isSFK?'Reel Dimensions & Quantity':'Dimensions & Quantity'} sub={isSFK?'Width mm · Metres per reel · Number of reels':'Internal dimensions in mm (L × W × H)'}/>
            {isSFK?(
              <div style={GRID.three}>
                <FieldLabel label="Reel Width (mm)" hint="Standard: 600 / 800 / 1000 / 1200"><TextInput type="number" value={form.sfkWidth} onChange={v=>set('sfkWidth',v)} placeholder="e.g. 1000"/></FieldLabel>
                <FieldLabel label="Metres per Reel"><TextInput type="number" value={form.sfkMetres} onChange={v=>set('sfkMetres',v)} placeholder="e.g. 500"/></FieldLabel>
                <FieldLabel label="Number of Reels"><TextInput type="number" value={form.sfkQty} onChange={v=>set('sfkQty',v)} placeholder="e.g. 50"/></FieldLabel>
              </div>
            ):(
              <>
                <div style={GRID.four}>
                  {[['Length (mm)','dimL','e.g. 355','Internal'],['Width (mm)','dimW','e.g. 265','Internal'],['Height (mm)','dimH','e.g. 240','Internal'],['Quantity (pcs)','qty','e.g. 5000','Total run']].map(([label,key,ph,hint])=>(
                    <FieldLabel key={key} label={label} hint={hint}><TextInput type="number" value={form[key]} onChange={v=>set(key,v)} placeholder={ph}/></FieldLabel>
                  ))}
                </div>
                {cost&&<InfoStrip items={[['Blank Length',`${cost.blankLmm} mm`],['Blank Width',`${cost.blankWmm} mm`],['Blank Area',`${cost.blankSqm} m²`]]}/>}
              </>
            )}
            {/* SFK info strip */}
            {isSFK&&cost&&(
              <InfoStrip items={[['m² per Reel',`${cost.sqmPerReel} m²`],['Liner per Reel',`${cost.linerKg} kg`],['Medium per Reel',`${cost.mediumKg} kg`]]}/>
            )}
          </Card>

          {/* 04 Finishing / SFK Notes */}
          {isSFK?(
            <Card>
              <SectionHeader number="04" title="SFK Notes" sub="End use · Core specification"/>
              <div style={GRID.two}>
                <FieldLabel label="End Use / Application"><TextInput value={form.sfkApplication||''} onChange={v=>set('sfkApplication',v)} placeholder="e.g. Flower farm stem wrap"/></FieldLabel>
                <FieldLabel label="Core ID">
                  <SelectInput value={form.sfkCore||'76mm'} onChange={v=>set('sfkCore',v)}>
                    <option value="76mm">76mm (3″) — Standard</option>
                    <option value="152mm">152mm (6″) — Heavy reel</option>
                  </SelectInput>
                </FieldLabel>
              </div>
              <div style={{marginTop:12,padding:'9px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#92400e',lineHeight:1.6}}>
                <strong>SFK routing:</strong> Corrugator only — exits before double-backer. No slotter, stitcher, or gluer. Priced per reel. 2-ply product (liner + medium, no second liner).
              </div>
            </Card>
          ):(
            <Card>
              <SectionHeader number="04" title="Ink, Finishing & Labour" sub="All optional — nil excludes from cost"/>
              <div style={{...GRID.two,marginBottom:14}}>
                <FieldLabel label="Ink Colours">
                  <SelectInput value={String(form.inkColours)} onChange={v=>set('inkColours',+v)}>
                    {[0,1,2,3,4].map(n=><option key={n} value={n}>{n===0?'Unprinted (0)':n+' Colour'+(n>1?'s':'')}</option>)}
                  </SelectInput>
                </FieldLabel>
                <FieldLabel label="Labour Type">
                  <SelectInput value={form.labourType} onChange={v=>set('labourType',v)}>
                    <option value="hourly">Hourly (KES 650/hr)</option>
                    <option value="piecework">Piecework (KES 1.20/pc)</option>
                  </SelectInput>
                </FieldLabel>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                <Toggle label="Lamination" checked={form.hasLam}    onChange={v=>set('hasLam',v)}/>
                <Toggle label="Die-Cut"    checked={form.hasDieCut} onChange={v=>set('hasDieCut',v)}/>
                <Toggle label="UV Varnish" checked={form.hasUV}     onChange={v=>set('hasUV',v)}/>
              </div>
            </Card>
          )}

          {/* 05 Selling Price */}
          <Card borderColor={cost?sc.border:'#e2e8f0'}>
            <SectionHeader number="05" title="Selling Price" sub={`Proposed price per ${cost?.unitLabel||'unit'} — margin calculated live`}/>
            <div style={GRID.two}>
              <FieldLabel label={`Proposed Price / ${cost?.unitLabel||'unit'} (KES excl. VAT)`} hint="Gross margin calculated live">
                <TextInput type="number" step="0.01"
                  value={isSFK?form.sfkSellingPrice:form.sellingPrice}
                  onChange={v=>set(isSFK?'sfkSellingPrice':'sellingPrice',v)}
                  placeholder={cost?`Floor: KES ${fmt(cost.floorEach)}`:'Enter inputs above first'}
                />
              </FieldLabel>
              {cost&&cost.marginPct!=null&&(
                <div style={{display:'flex',alignItems:'flex-end'}}>
                  <div style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 14px',background:sc.bg,border:`1.5px solid ${sc.border}`,borderRadius:6}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:sc.dot,flexShrink:0,animation:cost.approvalRequired?'pulse-dot 1.5s ease infinite':'none'}}/>
                    <div>
                      <div style={{fontSize:11,color:sc.text,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{sc.label}</div>
                      <div style={{fontSize:13,color:sc.text,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>Margin: {fmt(cost.marginPct,1)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginBottom:32}}>
            <button onClick={clearForm} style={{padding:'11px 22px',border:'none',background:'#2B3990',borderRadius:7,fontSize:12,fontFamily:"'IBM Plex Mono',monospace",cursor:'pointer',color:'#fff',fontWeight:600,letterSpacing:'.04em',boxShadow:'0 4px 14px rgba(43,57,144,.25)',display:'flex',alignItems:'center',gap:8}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create New Quote
            </button>
            <button disabled={!cost} onClick={()=>cost&&set('showModal',true)}
              style={{padding:'11px 28px',background:cost?'#2B3990':'#e2e8f0',border:'none',borderRadius:7,fontSize:12,fontFamily:"'IBM Plex Mono',monospace",cursor:cost?'pointer':'not-allowed',color:cost?'#fff':'#94a3b8',fontWeight:600,letterSpacing:'.04em',boxShadow:cost?'0 4px 14px rgba(43,57,144,.25)':'none',transition:'all .15s'}}>
              Preview &amp; Print Quote
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={'q-cost-col' + (costOpen ? ' is-open' : '')}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",color:'#2B3990',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:600}}>Live Cost Analysis</div>
            <button onClick={()=>setCostOpen(false)} className="q-cost-toggle" style={{border:'none',background:'transparent',color:'#64748b',fontSize:18,cursor:'pointer',padding:'4px 10px',lineHeight:1}} aria-label="Close cost panel">×</button>
          </div>
          <CostPanel cost={cost} isSFK={isSFK} form={form} style={style} board={board}/>
        </div>

        {/* Mobile floating cost-panel toggle */}
        <button onClick={()=>setCostOpen(o=>!o)}
          className="q-cost-toggle"
          style={{position:'fixed',right:14,bottom:14,zIndex:160,padding:'12px 18px',borderRadius:999,border:'none',background:'#2B3990',color:'#fff',boxShadow:'0 8px 22px rgba(43,57,144,.35)',fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:'.06em',cursor:'pointer',alignItems:'center',gap:8}}>
          {costOpen ? 'Close Cost' : (cost && cost.marginPct != null ? `Margin ${fmt(cost.marginPct,0)}%` : 'View Cost')}
        </button>
      </div>}

      {form.showModal&&cost&&(
        <PrintModal form={form} cost={cost} style={style} board={board} isSFK={isSFK} onClose={()=>set('showModal',false)}/>
      )}
    </>
  )
}
