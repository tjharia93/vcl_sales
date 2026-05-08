// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — PRINT LAYOUTS
//
// Layout A: Management Report  — PIN protected, full cost detail
// Layout B: Internal Approval  — Sales team, no cost, three signature blocks
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { STATUS_CONFIG, SFK_LINERS, SFK_MEDIUMS, SFK_FLUTES, PLY_LAYERS, LINER_TYPES } from '../data/masterData.js'
import { useCosting } from '../context/CostingContext.jsx'
import { fmt, todayStr } from './UI.jsx'
import { FlatLayout } from './Diagrams.jsx'

// ── SHARED HELPERS ────────────────────────────────────────────────────────────

const VCL_BLUE  = '#2B3990'
const VCL_RED   = '#ED1C24'

function PrintHeader({ title, quoteRef, subtitle }) {
  return (
    <div style={{ background: VCL_BLUE, padding:'20px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:20, color:'#fff', letterSpacing:'.01em' }}>VIMIT CONVERTERS LIMITED</div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,.55)', fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>
          P.O. Box 00100 · Nairobi, Kenya · info@vimit.com · +254 700 000 000
        </div>
        {subtitle && <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', fontFamily:"'IBM Plex Mono',monospace", marginTop:4, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' }}>{subtitle}</div>}
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:9, color:'rgba(255,255,255,.45)', fontFamily:"'IBM Plex Mono',monospace", textTransform:'uppercase', letterSpacing:'.1em' }}>{title}</div>
        <div style={{ fontSize:15, color:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, marginTop:3 }}>{quoteRef}</div>
      </div>
    </div>
  )
}

function MetaGrid({ items }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:18, paddingBottom:16, borderBottom:'1px solid #e2e8f0' }}>
      {items.map(([k,v]) => (
        <div key={k}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>{k}</div>
          <div style={{ fontSize:12, color:'#1e293b', fontFamily:"'DM Serif Display',Georgia,serif" }}>{v||'—'}</div>
        </div>
      ))}
    </div>
  )
}

function SpecCell({ label, value }) {
  return (
    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px' }}>
      <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>{label}</div>
      <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#1e293b', fontWeight:600, marginTop:2 }}>{value||'—'}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE, letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, marginBottom:8, marginTop:16 }}>{children}</div>
  )
}

function SignatureLine({ role, wide }) {
  return (
    <div style={{ flex: wide ? 2 : 1 }}>
      <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{role}</div>
      <div style={{ borderBottom:'1.5px solid #1e293b', marginBottom:4, minHeight:32 }}/>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8' }}>Name &amp; Signature</div>
        <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8' }}>Date</div>
      </div>
    </div>
  )
}

// ── MODAL SHELL ───────────────────────────────────────────────────────────────

function ModalShell({ children, onClose }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }}
    >
      <div style={{ background:'#fff', width:'100%', maxWidth:760, maxHeight:'94vh', overflowY:'auto', borderRadius:10, boxShadow:'0 24px 80px rgba(0,0,0,.4)' }}>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onPrint, printLabel='Print / Save PDF' }) {
  return (
    <div style={{ padding:'12px 28px 20px', display:'flex', gap:10, justifyContent:'flex-end', borderTop:'1px solid #e2e8f0' }}>
      <button onClick={onClose} style={{ padding:'10px 20px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', color:'#64748b' }}>Close</button>
      <button onClick={onPrint} style={{ padding:'10px 24px', background:VCL_BLUE, border:'none', borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', color:'#fff', fontWeight:600 }}>{printLabel}</button>
    </div>
  )
}

function buildPrintCSS() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    @page{size:A4 portrait;margin:10mm;}
    body{font-family:'IBM Plex Mono','Courier New',monospace;font-size:8pt;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    table{border-collapse:collapse;width:100%;}
    .page{width:100%;}
    /* Header — single blue bar, white text */
    .hdr{background:#2B3990;color:#fff;padding:8pt 10pt;display:flex;justify-content:space-between;align-items:center;margin-bottom:6pt;}
    .hdr-co{font-size:11pt;font-weight:700;letter-spacing:.02em;}
    .hdr-sub{font-size:6pt;opacity:.7;margin-top:2pt;}
    .hdr-ref{text-align:right;}
    .hdr-ref-lbl{font-size:5.5pt;opacity:.5;text-transform:uppercase;letter-spacing:.08em;}
    .hdr-ref-val{font-size:9pt;font-weight:700;margin-top:1pt;}
    /* Section headers — simple bold label, no background */
    .sec{margin-bottom:5pt;}
    .sec-lbl{font-size:6pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#2B3990;border-bottom:1.5pt solid #2B3990;padding-bottom:2pt;margin-bottom:4pt;}
    /* Field layout */
    .row{display:flex;gap:8pt;margin-bottom:4pt;}
    .fld{flex:1;min-width:0;}
    .fld-lbl{font-size:5.5pt;text-transform:uppercase;letter-spacing:.07em;color:#666;margin-bottom:1pt;}
    .fld-val{font-size:8pt;font-weight:600;border-bottom:0.75pt solid #111;padding-bottom:1pt;min-height:10pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    /* Dimension boxes — simple outlined */
    .dimbox{display:inline-flex;align-items:center;justify-content:center;width:30pt;height:18pt;border:1pt solid #111;font-size:9pt;font-weight:700;margin-right:2pt;}
    /* Checkboxes */
    .chk{display:inline-flex;align-items:center;gap:3pt;margin-right:7pt;font-size:7pt;}
    .cb{width:9pt;height:9pt;border:1pt solid #aaa;display:inline-flex;align-items:center;justify-content:center;font-size:7pt;}
    .cb-on{background:#2B3990;border-color:#2B3990;color:#fff;}
    /* Panel table */
    .ptbl{width:100%;margin-bottom:5pt;}
    .ptbl th{background:#2B3990;color:#fff;font-size:6pt;text-transform:uppercase;letter-spacing:.05em;padding:3pt 5pt;text-align:center;border:0.5pt solid #2B3990;}
    .ptbl td{font-size:8pt;font-weight:600;text-align:center;border:0.5pt solid #ccc;padding:4pt 5pt;}
    .ptbl td:first-child{text-align:left;font-size:7pt;}
    .ptbl-meta{font-size:6pt;color:#666;margin-bottom:1pt;}
    .ptbl-big{font-size:9pt;font-weight:700;color:#111;}
    /* Price row — simple outlined boxes, no colour fills */
    .price-row{display:flex;gap:6pt;margin-bottom:5pt;}
    .pc{flex:1;border:1pt solid #ccc;padding:6pt 7pt;}
    .pc-lbl{font-size:5.5pt;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:2pt;}
    .pc-val{font-size:12pt;font-weight:700;color:#111;}
    .pc-sub{font-size:6pt;color:#666;margin-top:1pt;}
    /* Signature block */
    .sig{display:flex;border:1pt solid #ccc;margin-bottom:5pt;}
    .sig-col{flex:1;padding:6pt 7pt;border-right:0.5pt solid #ccc;}
    .sig-col:last-child{border-right:none;}
    .sig-role{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#111;margin-bottom:4pt;}
    .sig-lbl{font-size:5.5pt;color:#888;margin-bottom:1pt;}
    .sig-line{border-bottom:0.75pt solid #aaa;min-height:14pt;margin-bottom:4pt;}
    .sig-req{background:#fff8e6;} /* very subtle amber tint only for required */
    .sig-req .sig-line{border-bottom-color:#f59e0b;}
    /* Cost table */
    .cost-tbl{width:100%;margin-bottom:5pt;}
    .cost-tbl th{background:#2B3990;color:#fff;font-size:6pt;text-transform:uppercase;letter-spacing:.05em;padding:3pt 5pt;text-align:right;border:0.5pt solid #2B3990;}
    .cost-tbl th:first-child{text-align:left;}
    .cost-tbl td{font-size:7.5pt;text-align:right;padding:3pt 5pt;border:0.5pt solid #ddd;}
    .cost-tbl td:first-child{text-align:left;}
    .cost-tbl tr:nth-child(even) td{background:#fafafa;}
    .cost-total td{font-weight:700;font-size:8.5pt;border-top:1.5pt solid #111;background:#f0f4ff;}
    /* Rates */
    .rates-row{display:flex;gap:4pt;margin-bottom:5pt;}
    .rc{flex:1;border:0.5pt solid #ddd;padding:3pt 5pt;text-align:center;}
    .rc-lbl{font-size:5pt;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1pt;}
    .rc-val{font-size:7.5pt;font-weight:700;}
    /* GSM strip */
    .gsm-strip{display:flex;border:0.5pt solid #ccc;margin-bottom:5pt;}
    .gsm-cell{flex:1;padding:3pt 5pt;text-align:center;border-right:0.5pt solid #ccc;}
    .gsm-cell:last-child{border-right:none;}
    .gsm-lbl{font-size:5pt;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1pt;}
    .gsm-val{font-size:9pt;font-weight:700;}
    /* Approval warning */
    .approve-warn{border:1.5pt solid #f59e0b;margin-bottom:5pt;}
    .approve-warn-hdr{background:#f59e0b;padding:3pt 7pt;font-size:7pt;font-weight:700;color:#fff;}
    .approve-warn-body{display:flex;padding:5pt 7pt;gap:20pt;}
    /* Misc */
    .mgmt-banner{border:1pt solid #ccc;border-left:3pt solid #2B3990;padding:3pt 7pt;margin-bottom:5pt;font-size:7pt;color:#333;font-weight:600;}
    .footer{font-size:5.5pt;color:#888;text-align:center;border-top:0.5pt solid #ddd;padding-top:3pt;margin-top:3pt;}
    .remarks-box{border:0.5pt solid #ccc;padding:4pt 7pt;margin-bottom:5pt;}
    .badge-req{font-size:6pt;font-weight:700;background:#f59e0b;color:#fff;padding:1pt 4pt;border-radius:2pt;margin-left:4pt;}
    .total-row{display:flex;gap:8pt;margin-bottom:3pt;}
    .total-item{flex:1;text-align:center;border:0.5pt solid #ccc;padding:4pt;}
    .total-lbl{font-size:5.5pt;color:#666;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2pt;}
    .total-val{font-size:11pt;font-weight:700;}
  `
}


function cb(checked) {
  return checked
    ? '<span class="cb cb-on">&#10003;</span>'
    : '<span class="cb"></span>'
}

function fmtN(n, d=2) {
  if (n == null || n === undefined || isNaN(n)) return '—'
  return Number(n).toLocaleString('en-KE', {minimumFractionDigits:d, maximumFractionDigits:d})
}

function buildApprovalHTML({ form, cost, style, board, isSFK, rates }) {
  const sp    = parseFloat(isSFK ? form.sfkSellingPrice : form.sellingPrice) || 0
  const qty   = parseFloat(isSFK ? form.sfkQty : form.qty) || 0
  const L     = parseFloat(form.dimL) || 0
  const W     = parseFloat(form.dimW) || 0
  const H     = parseFloat(form.dimH) || 0
  const blankL   = cost?.blankLmm || 0
  const blankW   = cost?.blankWmm || 0
  const areaSqm  = parseFloat(cost?.blankSqm) || 0
  const flapD    = W > 0 ? Math.round(W/2) : 0
  const ply      = form.ply || '3'
  const fluteCode= form.fluteCode || 'B'
  const paperQuality = board?.name || '—'
  const totalGSM = parseFloat(form._totalGSM) || 437.5
  const wtKgPer1000  = areaSqm > 0 ? Math.round(areaSqm * totalGSM) : 0
  const wtKgPerPc    = areaSqm > 0 ? (areaSqm * totalGSM / 1000).toFixed(4) : '—'
  const totalKgRaw   = qty && wtKgPer1000 ? (qty * wtKgPer1000 / 1000).toFixed(1) : '—'
  const pricePerKg   = Math.round((rates?.liner_kraft || 72000) / 1000)
  const is2Flap  = ['2FLAP_TRAY','RSC','2RSC','3RSC','FOL','OSC','HSC'].includes(form.styleCode)
  const is1Flap  = ['1FLAP_TRAY'].includes(form.styleCode)
  const isTray   = ['FLAT_TRAY','BLISS'].includes(form.styleCode)
  const isStitch = style?.join === 'Stitched'
  const isDieCut = form.hasDieCut || style?.join === 'Glued'
  const approvalReq = cost?.approvalRequired
  const marginPct   = cost?.marginPct
  const date = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>VCL Quotation ${form.quoteRef||''}</title>
<style>${buildPrintCSS()}</style></head><body><div class="page">

<div class="hdr">
  <div>
    <div class="hdr-co">VIMIT CONVERTERS LIMITED</div>
    <div class="hdr-sub">Quotation Origination &nbsp;·&nbsp; Internal document, not for external distribution</div>
    <div class="hdr-sub">P.O. Box 18560-00500, Nairobi &nbsp;·&nbsp; info@vimit.com &nbsp;·&nbsp; +254 746 506 802</div>
  </div>
  <div class="hdr-ref">
    <div class="hdr-ref-lbl">Reference</div>
    <div class="hdr-ref-val">${form.quoteRef||'—'}</div>
    <div style="font-size:7pt;opacity:.65;margin-top:2pt;">${date}</div>
  </div>
</div>

<div class="sec">
  <div class="sec-lbl">A &mdash; Customer &amp; Order Details</div>
  <div class="row">
    <div class="fld" style="flex:2"><div class="fld-lbl">Customer Name</div><div class="fld-val">${form.customer||''}</div></div>
    <div class="fld"><div class="fld-lbl">Sales Rep</div><div class="fld-val">${form.preparedBy||''}</div></div>
    <div class="fld"><div class="fld-lbl">Valid Until</div><div class="fld-val">${form.validUntil||''}</div></div>
    <div class="fld"><div class="fld-lbl">Payment Terms</div><div class="fld-val">${form.paymentTerms||''}</div></div>
  </div>
  <div class="row">
    <div class="fld" style="flex:2"><div class="fld-lbl">Job Description</div><div class="fld-val">${form.productDesc||''}</div></div>
    <div class="fld"><div class="fld-lbl">Colours</div><div class="fld-val">${+form.inkColours>0?form.inkColours+' colour(s)':'Plain (Unprinted)'}</div></div>
    <div class="fld"><div class="fld-lbl">Quantity Ordered</div><div class="fld-val">${qty?qty.toLocaleString():''} ${isSFK?'reels':'pcs'}</div></div>
    <div class="fld"><div class="fld-lbl">Customer Ref</div><div class="fld-val">${form.remarks||''}</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-lbl">B &mdash; Product Specification</div>
  <div class="row" style="align-items:flex-end;">
    <div>
      <div class="fld-lbl" style="margin-bottom:4pt;">Dimensions (mm)</div>
      <span class="dimbox">${L||''}</span><span style="font-size:7pt;margin-right:4pt;">L</span>
      <span class="dimbox">${W||''}</span><span style="font-size:7pt;margin-right:4pt;">W</span>
      <span class="dimbox">${H||''}</span><span style="font-size:7pt;">H</span>
    </div>
    <div style="flex:1;padding-left:12pt;">
      <div class="fld-lbl" style="margin-bottom:4pt;">Box Type &amp; Process</div>
      <span class="chk">${cb(is2Flap)}&nbsp;2 Flap RSC</span>
      <span class="chk">${cb(is1Flap)}&nbsp;1 Flap RSC</span>
      <span class="chk">${cb(isTray)}&nbsp;Tray (FTD)</span>
      &nbsp;&nbsp;
      <span class="chk">${cb(isStitch)}&nbsp;Stitched</span>
      <span class="chk">${cb(isDieCut)}&nbsp;Die-Cut</span>
      &nbsp;&nbsp;Ply:&nbsp;<strong>${ply}</strong>
    </div>
  </div>
  <div class="row" style="margin-top:5pt;">
    <div class="fld" style="flex:2"><div class="fld-lbl">Paper Quality</div><div class="fld-val">${isSFK?((form.sfkLiner||'')+'/'+(form.sfkMedium||'')):paperQuality}</div></div>
    <div class="fld" style="flex:.5"><div class="fld-lbl">Flute</div><div class="fld-val">${fluteCode}</div></div>
    <div class="fld"><div class="fld-lbl">Board Width (mm)</div><div class="fld-val">${blankW||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Cut Length (mm)</div><div class="fld-val">${blankL||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Flap Depth (mm)</div><div class="fld-val">${flapD||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Paper / KG</div><div class="fld-val">KES ${pricePerKg}</div></div>
  </div>
</div>

<div class="sec">
  <div class="sec-lbl">C &mdash; Panel &amp; Flap Dimensions (Creasing Layout)</div>
  <table class="ptbl">
    <thead><tr>
      <th style="text-align:left;width:80pt;">Type</th>
      <th>FLAP</th><th>H</th><th>FLAP</th><th>B.W</th><th>B.L</th><th>TOTAL</th>
    </tr></thead>
    <tbody>
      <tr>
        <td><div class="ptbl-meta">AREA SQM</div><div class="ptbl-big">${areaSqm.toFixed(4)}</div><div style="font-size:7pt;font-weight:700;margin-top:2pt;">FLAP</div></td>
        <td>${flapD||'—'}</td><td>${H||'—'}</td><td>${flapD||'—'}</td><td>${W||'—'}</td><td>—</td><td style="font-weight:700;">${blankW||'—'}</td>
      </tr>
      <tr>
        <td><div class="ptbl-meta">W.T KG / 1000</div><div class="ptbl-big">${wtKgPer1000||'—'}</div><div style="font-size:7pt;font-weight:700;margin-top:2pt;">PANEL</div></td>
        <td>${L||'—'}</td><td>${W||'—'}</td><td>${L||'—'}</td><td>${W||'—'}</td><td>30</td><td style="font-weight:700;">${blankL||'—'}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-lbl">D &mdash; Production Summary</div>
  <div class="row">
    <div class="fld"><div class="fld-lbl">Weight / Piece (kg)</div><div style="font-size:9pt;font-weight:700;">${wtKgPerPc}</div></div>
    <div class="fld"><div class="fld-lbl">Board Surface Area (m&sup2;)</div><div style="font-size:9pt;font-weight:700;">${areaSqm.toFixed(4)}</div></div>
    <div class="fld"><div class="fld-lbl">Total KG for Production</div><div style="font-size:9pt;font-weight:700;">${totalKgRaw} KGS</div></div>
    <div class="fld"><div class="fld-lbl">CTN Unit Weight</div><div style="font-size:9pt;font-weight:700;">${wtKgPerPc}</div></div>
  </div>
  <div style="margin-top:4pt;font-size:7pt;">
    <span class="chk">${cb(form.ply==='1')}&nbsp;1 PLY</span>
    <span class="chk">${cb(form.ply==='2')}&nbsp;2 PLY</span>
    <span class="chk">${cb(form.ply==='3')}&nbsp;3 PLY</span>
    <span class="chk">${cb(form.ply==='5')}&nbsp;5 PLY</span>
    &nbsp;&nbsp;&nbsp;
    <span class="chk">${cb(true)}&nbsp;Set PCS 25</span>
    <span class="chk">${cb(false)}&nbsp;Actual</span>
    <span class="chk">${cb(false)}&nbsp;Excess</span>
    <span class="chk">${cb(false)}&nbsp;Set PCS 50</span>
  </div>
</div>

<div class="sec">
  <div class="sec-lbl">E &mdash; Pricing</div>
  <div class="total-row">
    <div class="total-item">
      <div class="total-lbl">Unit Price (excl. VAT) / ${isSFK?'reel':'piece'}</div>
      <div class="total-val">${sp?'KES '+fmtN(sp):'Not set'}</div>
    </div>
    <div class="total-item">
      <div class="total-lbl">Quantity</div>
      <div class="total-val">${qty?qty.toLocaleString():'—'}</div>
    </div>
    <div class="total-item" style="border:1pt solid #111;">
      <div class="total-lbl">Total Value (excl. VAT)</div>
      <div class="total-val">${sp&&qty?'KES '+fmtN(sp*qty):'—'}</div>
    </div>
  </div>
  ${marginPct!=null?`<div style="font-size:7pt;color:#444;">Gross margin: <strong>${fmtN(marginPct,1)}%</strong>${approvalReq?' &nbsp;&mdash;&nbsp; <strong style="color:#92400e;">Below floor margin &mdash; approval required</strong>':''}</div>`:''}
</div>

<div class="sec">
  <div class="sec-lbl">F &mdash; Approval Signatures</div>
  <div style="font-size:6.5pt;color:#555;margin-bottom:4pt;">All three parties must sign before this quotation is issued to the customer.${approvalReq?' <strong>CFO/MD signature mandatory &mdash; price below approved margin floor.</strong>':''}</div>
  <div class="sig">
    <div class="sig-col">
      <div class="sig-role">01 &mdash; Sales Representative</div>
      <div class="sig-lbl">Name</div><div class="sig-line"></div>
      <div class="sig-lbl">Signature</div><div class="sig-line" style="min-height:20pt;"></div>
      <div class="sig-lbl">Date</div><div class="sig-line"></div>
    </div>
    <div class="sig-col">
      <div class="sig-role">02 &mdash; Sales Manager</div>
      <div class="sig-lbl">Name</div><div class="sig-line"></div>
      <div class="sig-lbl">Signature</div><div class="sig-line" style="min-height:20pt;"></div>
      <div class="sig-lbl">Date</div><div class="sig-line"></div>
    </div>
    <div class="sig-col ${approvalReq?'sig-req':''}">
      <div class="sig-role">03 &mdash; CFO / MD${approvalReq?'<span class="badge-req">REQUIRED</span>':''}</div>
      <div class="sig-lbl">Name</div><div class="${approvalReq?'sig-line sig-amber':'sig-line'}"></div>
      <div class="sig-lbl">Signature</div><div class="${approvalReq?'sig-line sig-amber':'sig-line'}" style="min-height:20pt;"></div>
      <div class="sig-lbl">Date</div><div class="${approvalReq?'sig-line sig-amber':'sig-line'}"></div>
    </div>
  </div>
</div>

<div class="remarks-box">
  <div style="font-size:6pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:5pt;">Management Remarks</div>
  <div style="border-bottom:0.5pt solid #ccc;min-height:16pt;margin-bottom:5pt;"></div>
  <div class="row">
    <div class="fld"><div class="fld-lbl">Reel Size</div><div class="fld-val">${blankW?blankW+' mm':''}</div></div>
    <div class="fld"><div class="fld-lbl">UPS</div><div class="fld-val"></div></div>
    <div class="fld" style="flex:2"><div class="fld-lbl">GSM</div><div class="fld-val">${paperQuality}</div></div>
    <div class="fld"><div class="fld-lbl">Sheet</div><div class="fld-val"></div></div>
  </div>
  <div class="row">
    <div class="fld" style="flex:2"><div class="fld-lbl">Approved By</div><div class="fld-val"></div></div>
    <div class="fld"><div class="fld-lbl">Date</div><div class="fld-val"></div></div>
    <div class="fld" style="flex:2"><div class="fld-lbl">Signature</div><div class="fld-val"></div></div>
  </div>
</div>

<div class="footer">OFFICE LINE: +254 746 506 802 &nbsp;&middot;&nbsp; EMAIL: info@vimit.com &nbsp;&middot;&nbsp; OFF MOMBASA ROAD (WEST OF JKIA) &nbsp;&middot;&nbsp; P.O BOX 18560-00500, NAIROBI KENYA</div>

</div><script>window.onload=function(){window.print();setTimeout(()=>window.close(),1500)}<\/script></body></html>`
}


function buildManagementHTML({ form, cost, style, board, isSFK, rates }) {
  const sp    = parseFloat(isSFK ? form.sfkSellingPrice : form.sellingPrice) || 0
  const qty   = parseFloat(isSFK ? form.sfkQty : form.qty) || 0
  const blankL   = cost?.blankLmm || 0
  const blankW   = cost?.blankWmm || 0
  const areaSqm  = parseFloat(cost?.blankSqm) || 0
  const approvalReq = cost?.approvalRequired
  const marginPct   = cost?.marginPct
  const sc_labels = {good:'Within Target',below_target:'Below Target',approval:'Below Floor — Approval Required',loss:'Loss — Below Full Cost',unset:'Price Not Set'}
  const statusLabel = sc_labels[cost?.priceStatus] || '—'
  const date = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})

  // GSM layer strip
  let gsmStrip = ''
  if (!isSFK && board) {
    const layerDefs = [
      {key:'topLiner',label:'Top Liner',role:'liner'},
      {key:'medium1',label:'Medium 1',role:'medium'},
      {key:'midLiner',label:'Centre Liner',role:'liner'},
      {key:'medium2',label:'Medium 2',role:'medium'},
      {key:'botLiner',label:'Bottom Liner',role:'liner'},
    ].filter(l => form.ply==='5' || !['midLiner','medium2'].includes(l.key))
    gsmStrip = layerDefs.map(l => {
      const gsm = form[`gsm_${l.key}`] || (l.role==='liner'?120:112)
      return `<div class="gsm-cell"><div class="gsm-lbl">${l.label}</div><div class="gsm-val">${gsm} GSM</div></div>`
    }).join('')
  }

  const rows = (cost?.rows || []).map((r,i) => {
    const pct = cost.fullTot > 0 ? (r.tot/cost.fullTot*100).toFixed(1) : '—'
    const bg = i%2===0?'':'background:#fafafa;'
    return `<tr><td style="${bg}">${r.label}</td><td style="${bg}text-align:right;">KES ${fmtN(r.each)}</td><td style="${bg}text-align:right;">KES ${fmtN(r.tot)}</td><td style="${bg}text-align:right;">${pct}%</td></tr>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>VCL Management Report ${form.quoteRef||''}</title>
<style>${buildPrintCSS()}</style></head><body><div class="page">

<div class="hdr">
  <div>
    <div class="hdr-co">VIMIT CONVERTERS LIMITED</div>
    <div class="hdr-sub">Management Cost Report &nbsp;&middot;&nbsp; CONFIDENTIAL &mdash; Not for distribution outside management</div>
  </div>
  <div class="hdr-ref">
    <div class="hdr-ref-lbl">Reference</div>
    <div class="hdr-ref-val">${form.quoteRef||'—'}</div>
    <div style="font-size:7pt;opacity:.65;margin-top:2pt;">${date}</div>
  </div>
</div>

<div class="mgmt-banner">CONFIDENTIAL MANAGEMENT DOCUMENT &mdash; Internal use only. Not for external distribution. Prices exclude VAT.</div>

<div class="sec">
  <div class="sec-lbl">Quote Details</div>
  <div class="row">
    <div class="fld" style="flex:2"><div class="fld-lbl">Customer</div><div class="fld-val">${form.customer||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Prepared By</div><div class="fld-val">${form.preparedBy||'—'}</div></div>
    <div class="fld" style="flex:2"><div class="fld-lbl">Product</div><div class="fld-val">${form.productDesc||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Valid Until</div><div class="fld-val">${form.validUntil||'—'}</div></div>
    <div class="fld"><div class="fld-lbl">Payment</div><div class="fld-val">${form.paymentTerms||'—'}</div></div>
  </div>
</div>

${gsmStrip?`
<div class="sec">
  <div class="sec-lbl">Board Build &mdash; GSM per Layer</div>
  <div class="gsm-strip">${gsmStrip}</div>
</div>`:''}

<div class="sec">
  <div class="sec-lbl">Cost Build-Up</div>
  <table class="cost-tbl">
    <thead><tr>
      <th style="text-align:left;">Cost Element</th>
      <th style="text-align:right;">Per ${cost?.unitLabel||'piece'}</th>
      <th style="text-align:right;">Total</th>
      <th style="text-align:right;">% of Total</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="cost-total">
        <td>Full Cost</td>
        <td style="text-align:right;">KES ${fmtN(cost?.fullEach)}</td>
        <td style="text-align:right;">KES ${fmtN(cost?.fullTot)}</td>
        <td style="text-align:right;">100%</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="sec">
  <div class="sec-lbl">Pricing Analysis</div>
  <div class="price-row">
    <div class="pc">
      <div class="pc-lbl">Full Cost / ${cost?.unitLabel||'piece'}</div>
      <div class="pc-val">KES ${fmtN(cost?.fullEach)}</div>
    </div>
    <div class="pc">
      <div class="pc-lbl">Floor Price (${rates?.margin_floor||15}% margin)</div>
      <div class="pc-val">KES ${fmtN(cost?.floorEach)}</div>
    </div>
    <div class="pc">
      <div class="pc-lbl">Target Price (${rates?.margin_target||25}% margin)</div>
      <div class="pc-val">KES ${fmtN(cost?.targetEach)}</div>
    </div>
    <div class="pc" style="border:1.5pt solid #111;">
      <div class="pc-lbl">Quoted Price</div>
      <div class="pc-val">${sp?'KES '+fmtN(sp):'Not set'}</div>
      ${marginPct!=null?`<div class="pc-sub">Margin: <strong>${fmtN(marginPct,1)}%</strong></div>`:''}
    </div>
  </div>
  <div style="font-size:7pt;color:#444;">Status: <strong>${statusLabel}</strong>
  ${sp&&qty?`&nbsp;&nbsp;&middot;&nbsp;&nbsp;Total Revenue: <strong>KES ${fmtN(sp*qty)}</strong>`:''}
  </div>
</div>

<div class="sec">
  <div class="sec-lbl">Rates Applied</div>
  <div class="rates-row">
    ${[['Overhead',rates?.overhead_pct+'%'],['Floor Margin',rates?.margin_floor+'%'],['Target Margin',rates?.margin_target+'%'],['Slotter','KES '+Number(rates?.slotter_rate||0).toLocaleString()+'/hr'],['Labour','KES '+Number(rates?.labour_hourly||0).toLocaleString()+'/hr'],['Efficiency',rates?.efficiency_pct+'%']]
      .map(([k,v])=>`<div class="rc"><div class="rc-lbl">${k}</div><div class="rc-val">${v}</div></div>`).join('')}
  </div>
</div>

${approvalReq?`
<div class="approve-warn">
  <div class="approve-warn-hdr">MANAGEMENT APPROVAL REQUIRED &mdash; Quoted price is below the ${rates?.margin_floor||15}% approved floor margin</div>
  <div class="approve-warn-body">
    <div style="flex:1;">
      <div class="sig-lbl">CFO / Financial Authority</div>
      <div class="sig-line" style="border-bottom-color:#f59e0b;min-height:22pt;"></div>
      <div class="sig-lbl">Name &amp; Signature / Date</div>
    </div>
    <div style="flex:1;">
      <div class="sig-lbl">MD / Commercial Authority</div>
      <div class="sig-line" style="border-bottom-color:#f59e0b;min-height:22pt;"></div>
      <div class="sig-lbl">Name &amp; Signature / Date</div>
    </div>
  </div>
</div>`:''}

${form.remarks?`<div class="remarks-box"><div style="font-size:6pt;color:#666;margin-bottom:3pt;">REMARKS</div><div style="font-size:8pt;">${form.remarks}</div></div>`:''}

<div class="footer">CONFIDENTIAL MANAGEMENT DOCUMENT &nbsp;&middot;&nbsp; Not for external distribution &nbsp;&middot;&nbsp; Prices exclude VAT &nbsp;&middot;&nbsp; Generated ${date}</div>

</div><script>window.onload=function(){window.print();setTimeout(()=>window.close(),1500)}<\/script></body></html>`
}


// Main print dispatcher — generates fresh HTML from data, not DOM clone.
// Mobile browsers commonly block `window.open` when not from a tightly-scoped
// user gesture; if that happens we fall back to a hidden iframe and trigger
// the print there. This keeps the same A4-fit output without depending on
// popups or a separate tab.
function doPrint(tabId, { form, cost, style, board, isSFK, rates }) {
  const isApproval = tabId === 'approval-tab-body'
  const html = isApproval
    ? buildApprovalHTML({ form, cost, style, board, isSFK, rates })
    : buildManagementHTML({ form, cost, style, board, isSFK, rates })

  // 1) Preferred path — open a tab, write the document, browser auto-prints.
  let w = null
  try { w = window.open('', '_blank', 'width=900,height=700') } catch { w = null }
  if (w && w.document) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    return
  }

  // 2) Mobile / popup-blocked fallback — render into a hidden iframe and
  //    invoke print on its contentWindow. Removed after the print dialog
  //    closes so we don't leak DOM nodes.
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
  document.body.appendChild(iframe)
  const cleanup = () => { try { document.body.removeChild(iframe) } catch {} }
  iframe.onload = () => {
    try {
      const cw = iframe.contentWindow
      cw.focus()
      cw.print()
    } catch (e) {
      alert('Could not start print. Please use the browser menu → Print, or allow popups for this site.')
    }
    setTimeout(cleanup, 1500)
  }
  iframe.srcdoc = html
}


// ── PIN LOCK (inline, for management print) ───────────────────────────────────

function PINEntry({ onSuccess, onCancel, correctPin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const tap = (digit) => {
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === correctPin) {
        onSuccess()
      } else {
        setError(true)
        setTimeout(() => { setPin(''); setError(false) }, 700)
      }
    }
  }

  return (
    <div style={{ padding:'32px 28px', textAlign:'center' }}>
      <div style={{ width:48, height:48, background:'#f0f4ff', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={VCL_BLUE} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:18, color:'#1e293b', marginBottom:6 }}>Management Print</div>
      <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:24 }}>Enter Costing PIN to unlock full cost report</div>

      {/* PIN dots */}
      <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:14, height:14, borderRadius:'50%',
            background: pin.length > i ? (error ? VCL_RED : VCL_BLUE) : '#e2e8f0',
            transition:'all .15s',
          }}/>
        ))}
      </div>

      {/* Keypad */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, maxWidth:240, margin:'0 auto 16px' }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
          k === '' ? <div key={i}/> :
          <button key={i} onClick={() => k === '⌫' ? setPin(p=>p.slice(0,-1)) : tap(String(k))}
            style={{ padding:'13px 0', border:'1.5px solid #e2e8f0', borderRadius:8, background:'#fff', fontFamily:"'IBM Plex Mono',monospace", fontSize:15, color:'#1e293b', cursor:'pointer', fontWeight:600 }}
          >{k}</button>
        ))}
      </div>

      {error && <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:VCL_RED, marginBottom:12 }}>Incorrect PIN</div>}

      <button onClick={onCancel} style={{ marginTop:8, padding:'8px 20px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:6, fontSize:11, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', color:'#64748b' }}>Cancel</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT A — MANAGEMENT REPORT
// PIN protected. Full cost detail, GSM breakdown, margin analysis.
// ─────────────────────────────────────────────────────────────────────────────

function ManagementPrint({ form, cost, style, board, isSFK, onClose }) {
  const { rates } = useCosting()
  const sc = STATUS_CONFIG[cost.priceStatus]
  const sp = isSFK ? parseFloat(form.sfkSellingPrice)||0 : parseFloat(form.sellingPrice)||0

  const liner  = SFK_LINERS.find(x => x.code === form.sfkLiner)
  const medium = SFK_MEDIUMS.find(x => x.code === form.sfkMedium)
  const flute  = SFK_FLUTES.find(x => x.code === form.sfkFlute)

  // Board layer breakdown for print
  const layers = !isSFK && board ? PLY_LAYERS[form.ply] || [] : []

  const specCells = isSFK ? [
    ['Product Type','Single Face Kraft (SFK)'],
    ['Reel Width', form.sfkWidth ? form.sfkWidth+' mm' : '—'],
    ['Metres / Reel', form.sfkMetres ? form.sfkMetres+' m' : '—'],
    ['Quantity', form.sfkQty ? Number(form.sfkQty).toLocaleString()+' reels' : '—'],
    ['Kraft Liner', liner?.name||'—'],
    ['Fluting Medium', medium?.name||'—'],
    ['Flute', flute?.name||'—'],
    ['m² / Reel', cost.sqmPerReel ? cost.sqmPerReel+' m²' : '—'],
  ] : [
    ['Style', style?.name||'—'],
    ['FEFCO', style?.fefco||'—'],
    ['Board', board?.name||'—'],
    ['Dimensions', form.dimL&&form.dimW&&form.dimH ? `${form.dimL}×${form.dimW}×${form.dimH} mm` : '—'],
    ['Quantity', form.qty ? Number(form.qty).toLocaleString()+' pcs' : '—'],
    ['Blank Size', cost.blankLmm ? `${cost.blankLmm}×${cost.blankWmm} mm` : '—'],
    ['Join Type', style?.join||'—'],
    ['Ink', +form.inkColours>0 ? form.inkColours+' colour(s)' : 'Unprinted'],
  ]

  return (
    <ModalShell onClose={onClose}>
      <PrintHeader title="Management Report — Confidential" quoteRef={form.quoteRef} subtitle="Internal Cost Document"/>

      <div id="mgmt-print-content" style={{ padding:'22px 28px' }}>

        {/* Confidential banner */}
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'8px 14px', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:VCL_RED, flexShrink:0 }}/>
          <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#b91c1c', fontWeight:600, letterSpacing:'.06em' }}>CONFIDENTIAL — Not for distribution outside management</span>
        </div>

        <MetaGrid items={[
          ['Date', todayStr()],
          ['Prepared By', form.preparedBy],
          ['Customer', form.customer],
          ['Product', form.productDesc],
          ['Valid Until', form.validUntil],
          ['Payment Terms', form.paymentTerms],
        ]}/>

        {/* Flat layout */}
        {!isSFK && form.dimL && form.dimW && form.dimH && (
          <>
            <SectionTitle>Blank Layout</SectionTitle>
            <div style={{ padding:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:4 }}>
              <FlatLayout styleCode={form.styleCode} dimL={form.dimL} dimW={form.dimW} dimH={form.dimH} blankLmm={cost.blankLmm} blankWmm={cost.blankWmm}/>
            </div>
          </>
        )}

        {/* Spec */}
        <SectionTitle>{isSFK ? 'SFK Specification' : 'Carton Specification'}</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:4 }}>
          {specCells.map(([k,v]) => <SpecCell key={k} label={k} value={v}/>)}
        </div>

        {/* Board layer GSM breakdown */}
        {!isSFK && layers.length > 0 && (
          <>
            <SectionTitle>Board Build — GSM per Layer</SectionTitle>
            <div style={{ display:'flex', gap:0, border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', marginBottom:4 }}>
              {layers.map((layer, i) => {
                const gsm  = form[`gsm_${layer.key}`] || layer.defaultGSM
                const type = layer.role === 'liner' ? (form[`type_${layer.key}`] || layer.defaultType) : null
                const lt   = type ? LINER_TYPES.find(x => x.code === type) : null
                const isLast = i === layers.length - 1
                return (
                  <div key={layer.key} style={{ flex:1, padding:'8px 10px', background: layer.role==='liner'?'#f0f4ff':'#fffbeb', borderRight: isLast?'none':'1px solid #e2e8f0', textAlign:'center' }}>
                    <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{layer.label}</div>
                    <div style={{ fontSize:13, fontFamily:"'DM Serif Display',Georgia,serif", color: layer.role==='liner'?VCL_BLUE:'#92400e' }}>{gsm} GSM</div>
                    {lt && <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#64748b', marginTop:2 }}>{lt.name}</div>}
                    <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginTop:1 }}>{layer.role==='liner'?'Liner':'Medium'}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Cost build-up table */}
        <SectionTitle>Cost Build-Up</SectionTitle>
        <table style={{ width:'100%', borderCollapse:'collapse', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', marginBottom:4 }}>
          <thead>
            <tr style={{ background:VCL_BLUE }}>
              {['Cost Element', `Per ${cost.unitLabel}`, 'Total', '% of Total'].map((h,i) => (
                <th key={h} style={{ padding:'7px 10px', textAlign:i===0?'left':'right', fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#fff', letterSpacing:'.08em', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cost.rows.map((r, i) => {
              const pct = cost.fullTot > 0 ? (r.tot / cost.fullTot * 100).toFixed(1) : '—'
              return (
                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0?'#fff':'#fafbff' }}>
                  <td style={{ padding:'6px 10px', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>{r.label}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>KES {fmt(r.each)}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>KES {fmt(r.tot)}</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8' }}>{pct}%</td>
                </tr>
              )
            })}
            <tr style={{ borderTop:'2px solid '+VCL_BLUE, background:'#f0f4ff' }}>
              <td style={{ padding:'9px 10px', fontFamily:"'DM Serif Display',Georgia,serif", fontSize:13, color:VCL_BLUE, fontWeight:600 }}>Full Cost</td>
              <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:VCL_BLUE, fontWeight:700 }}>KES {fmt(cost.fullEach)}</td>
              <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:VCL_BLUE, fontWeight:700 }}>KES {fmt(cost.fullTot)}</td>
              <td style={{ padding:'9px 10px', textAlign:'right', fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE }}>100%</td>
            </tr>
          </tbody>
        </table>

        {/* Pricing analysis */}
        <SectionTitle>Pricing Analysis</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
          {[
            { k:'Full Cost',     v:`KES ${fmt(cost.fullEach)}`,   bg:'#f8fafc', border:'#e2e8f0', text:'#1e293b' },
            { k:'Floor Price',   v:`KES ${fmt(cost.floorEach)}`,  bg:'#fff7ed', border:'#fed7aa', text:'#c2410c' },
            { k:'Target Price',  v:`KES ${fmt(cost.targetEach)}`, bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d' },
            { k:'Quoted Price',  v: sp ? `KES ${fmt(sp)}` : 'Not set', bg:sc.bg, border:sc.border+'44', text:sc.text },
          ].map(r => (
            <div key={r.k} style={{ background:r.bg, border:`1.5px solid ${r.border}`, borderRadius:7, padding:'10px 12px' }}>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:r.text, textTransform:'uppercase', letterSpacing:'.06em', opacity:.8 }}>{r.k}</div>
              <div style={{ fontSize:15, fontFamily:"'DM Serif Display',Georgia,serif", color:r.text, marginTop:4 }}>{r.v}</div>
            </div>
          ))}
        </div>

        {cost.marginPct != null && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:sc.bg, border:`1.5px solid ${sc.border}`, borderRadius:6, marginBottom:12 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:sc.dot, flexShrink:0 }}/>
            <div>
              <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, fontWeight:600 }}>{sc.label}</span>
              <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, marginLeft:16 }}>Gross Margin: <strong>{fmt(cost.marginPct,1)}%</strong></span>
              {sp > 0 && <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, marginLeft:16 }}>Total Revenue: <strong>KES {fmt(sp * (parseFloat(form.qty||form.sfkQty)||1))}</strong></span>}
            </div>
          </div>
        )}

        {/* Key rates used */}
        <SectionTitle>Rates Applied</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:14 }}>
          {[
            ['Overhead', rates.overhead_pct+'%'],
            ['Slotter', 'KES '+Number(rates.slotter_rate).toLocaleString()+'/hr'],
            ['Labour', 'KES '+Number(rates.labour_hourly).toLocaleString()+'/hr'],
            ['Efficiency', rates.efficiency_pct+'%'],
            ['Floor Margin', rates.margin_floor+'%'],
          ].map(([k,v]) => (
            <div key={k} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'7px 9px', textAlign:'center' }}>
              <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#1e293b', fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Approval block */}
        {cost.approvalRequired && (
          <div style={{ border:'2px solid #f59e0b', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
            <div style={{ background:'#f59e0b', padding:'7px 14px' }}>
              <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#fff', fontWeight:700, letterSpacing:'.08em' }}>MANAGEMENT APPROVAL REQUIRED — Price below {rates.margin_floor}% floor</span>
            </div>
            <div style={{ padding:'14px 16px', display:'flex', gap:24 }}>
              <SignatureLine role="CFO / Financial Authority"/>
              <SignatureLine role="MD / Commercial Authority"/>
            </div>
          </div>
        )}

        {form.remarks && (
          <div style={{ padding:'9px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:12 }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Remarks</div>
            <div style={{ fontSize:11, color:'#475569', fontFamily:"'IBM Plex Mono',monospace" }}>{form.remarks}</div>
          </div>
        )}

        <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace", textAlign:'center', paddingTop:12, borderTop:'1px solid #e2e8f0' }}>
          CONFIDENTIAL MANAGEMENT DOCUMENT · Not for external distribution · Prices exclude VAT · Generated {todayStr()}
        </div>
      </div>

      <ModalFooter onClose={onClose} onPrint={() => doPrint('management', {form,cost,style,board,isSFK,rates})} printLabel="Print Management Report"/>
    </ModalShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT B — INTERNAL APPROVAL SHEET
// No cost detail. Three signature blocks. For sign-off before quote to customer.
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalPrint({ form, cost, style, board, isSFK, onClose }) {
  const sc = STATUS_CONFIG[cost.priceStatus]
  const sp = isSFK ? parseFloat(form.sfkSellingPrice)||0 : parseFloat(form.sellingPrice)||0
  const qty = parseFloat(isSFK ? form.sfkQty : form.qty) || 0
  const liner  = SFK_LINERS.find(x => x.code === form.sfkLiner)
  const medium = SFK_MEDIUMS.find(x => x.code === form.sfkMedium)
  const flute  = SFK_FLUTES.find(x => x.code === form.sfkFlute)

  const specCells = isSFK ? [
    ['Product Type','Single Face Kraft (SFK)'],
    ['Reel Width', form.sfkWidth ? form.sfkWidth+' mm' : '—'],
    ['Metres / Reel', form.sfkMetres ? form.sfkMetres+' m' : '—'],
    ['Quantity', qty ? qty.toLocaleString()+' reels' : '—'],
    ['Kraft Liner', liner?.name||'—'],
    ['Fluting Medium', medium?.name||'—'],
    ['Flute', flute?.name||'—'],
    ['m² / Reel', cost.sqmPerReel ? cost.sqmPerReel+' m²' : '—'],
  ] : [
    ['Carton Style', style?.name||'—'],
    ['FEFCO Code', style?.fefco||'—'],
    ['Board Grade', board?.name||'—'],
    ['Dimensions (mm)', form.dimL&&form.dimW&&form.dimH ? `${form.dimL} × ${form.dimW} × ${form.dimH}` : '—'],
    ['Quantity', qty ? qty.toLocaleString()+' pieces' : '—'],
    ['Blank Size', cost.blankLmm ? `${cost.blankLmm} × ${cost.blankWmm} mm` : '—'],
    ['Join Type', style?.join||'—'],
    ['Printing', +form.inkColours>0 ? form.inkColours+' colour(s)' : 'Unprinted'],
  ]

  return (
    <ModalShell onClose={onClose}>
      <PrintHeader title="Internal Quotation Approval" quoteRef={form.quoteRef} subtitle="Approval required before issuing to customer"/>

      <div id="approval-print-content" style={{ padding:'22px 28px' }}>

        <MetaGrid items={[
          ['Date', todayStr()],
          ['Prepared By', form.preparedBy],
          ['Customer / Account', form.customer],
          ['Product Description', form.productDesc],
          ['Quote Valid Until', form.validUntil],
          ['Payment Terms', form.paymentTerms],
        ]}/>

        {/* Blank layout diagram */}
        {!isSFK && form.dimL && form.dimW && form.dimH && (
          <>
            <SectionTitle>Carton Blank Layout</SectionTitle>
            <div style={{ padding:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:4 }}>
              <FlatLayout styleCode={form.styleCode} dimL={form.dimL} dimW={form.dimW} dimH={form.dimH} blankLmm={cost.blankLmm} blankWmm={cost.blankWmm}/>
            </div>
          </>
        )}

        {/* Spec */}
        <SectionTitle>Product Specification</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:4 }}>
          {specCells.map(([k,v]) => <SpecCell key={k} label={k} value={v}/>)}
        </div>

        {/* Quoted price — prominent */}
        <SectionTitle>Quotation Value</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
          <div style={{ background:VCL_BLUE, borderRadius:8, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:'.08em' }}>Unit Price (excl. VAT)</div>
            <div style={{ fontSize:22, fontFamily:"'DM Serif Display',Georgia,serif", color:'#fff', marginTop:5 }}>
              {sp ? `KES ${fmt(sp)}` : 'Not set'}
            </div>
            <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'rgba(255,255,255,.6)', marginTop:3 }}>per {cost.unitLabel}</div>
          </div>
          <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em' }}>Quantity</div>
            <div style={{ fontSize:22, fontFamily:"'DM Serif Display',Georgia,serif", color:'#1e293b', marginTop:5 }}>
              {qty ? qty.toLocaleString() : '—'}
            </div>
            <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginTop:3 }}>{cost.qtyLabel}</div>
          </div>
          <div style={{ background:'#f0fdf4', border:'1.5px solid #bbf7d0', borderRadius:8, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#15803d', textTransform:'uppercase', letterSpacing:'.08em' }}>Total Value (excl. VAT)</div>
            <div style={{ fontSize:22, fontFamily:"'DM Serif Display',Georgia,serif", color:'#15803d', marginTop:5 }}>
              {sp && qty ? `KES ${fmt(sp * qty)}` : '—'}
            </div>
            <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#15803d', marginTop:3 }}>+ 16% VAT where applicable</div>
          </div>
        </div>

        {/* Price status badge */}
        {cost.priceStatus !== 'unset' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:sc.bg, border:`1.5px solid ${sc.border}`, borderRadius:6, marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:sc.dot, flexShrink:0 }}/>
            <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, fontWeight:600 }}>{sc.label}</span>
            {cost.approvalRequired && (
              <span style={{ marginLeft:8, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:sc.text }}>— CFO/MD approval required before issuing</span>
            )}
          </div>
        )}

        {form.remarks && (
          <div style={{ padding:'9px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:16 }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Remarks / Special Conditions</div>
            <div style={{ fontSize:11, color:'#475569', fontFamily:"'IBM Plex Mono',monospace" }}>{form.remarks}</div>
          </div>
        )}

        {/* ── THREE SIGNATURE BLOCKS ── */}
        <SectionTitle>Approval Signatures</SectionTitle>
        <div style={{ border:'2px solid #e2e8f0', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
          {/* Header */}
          <div style={{ background:'#f8fafc', padding:'8px 16px', borderBottom:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#64748b' }}>
              By signing below, each party confirms the quotation details are correct and authorises the quote to be issued to the customer.
            </div>
          </div>

          <div style={{ display:'flex', gap:0 }}>
            {/* Sales Rep */}
            <div style={{ flex:1, padding:'20px 20px 16px', borderRight:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600, marginBottom:12 }}>01 — Sales Representative</div>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Name</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', marginBottom:16, minHeight:22 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Signature</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', marginBottom:16, minHeight:36 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Date</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', minHeight:22 }}/>
            </div>

            {/* Sales Manager */}
            <div style={{ flex:1, padding:'20px 20px 16px', borderRight:'1px solid #e2e8f0' }}>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600, marginBottom:12 }}>02 — Sales Manager</div>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Name</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', marginBottom:16, minHeight:22 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Signature</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', marginBottom:16, minHeight:36 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Date</div>
              <div style={{ borderBottom:'1px solid #cbd5e1', minHeight:22 }}/>
            </div>

            {/* CFO/MD */}
            <div style={{ flex:1, padding:'20px 20px 16px', background: cost.approvalRequired ? '#fffbeb' : '#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color: cost.approvalRequired ? '#92400e' : VCL_BLUE, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600 }}>03 — CFO / MD</div>
                {cost.approvalRequired && (
                  <span style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", background:'#f59e0b', color:'#fff', padding:'2px 6px', borderRadius:4, fontWeight:700 }}>REQUIRED</span>
                )}
              </div>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Name</div>
              <div style={{ borderBottom:`1px solid ${cost.approvalRequired?'#f59e0b':'#cbd5e1'}`, marginBottom:16, minHeight:22 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Signature</div>
              <div style={{ borderBottom:`1px solid ${cost.approvalRequired?'#f59e0b':'#cbd5e1'}`, marginBottom:16, minHeight:36 }}/>
              <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginBottom:4 }}>Date</div>
              <div style={{ borderBottom:`1px solid ${cost.approvalRequired?'#f59e0b':'#cbd5e1'}`, minHeight:22 }}/>
            </div>
          </div>
        </div>

        <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace", textAlign:'center', paddingTop:12, borderTop:'1px solid #e2e8f0' }}>
          Internal document · Quote valid until {form.validUntil||'—'} · Prices exclude VAT · {todayStr()}
        </div>
      </div>

      <ModalFooter onClose={onClose} onPrint={() => doPrint('approval-tab-body', {form,cost,style,board,isSFK,rates})} printLabel="Print Approval Sheet"/>
    </ModalShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — Print Modal with tab selector
// ─────────────────────────────────────────────────────────────────────────────

export function PrintModal({ form, cost, style, board, isSFK, onClose }) {
  const { rates } = useCosting()
  const [activeTab, setActiveTab] = useState('approval')   // 'approval' | 'management'
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const handleManagementTab = () => {
    if (pinUnlocked) {
      setActiveTab('management')
    } else {
      setShowPin(true)
    }
  }

  // PIN entry screen
  if (showPin) {
    return (
      <ModalShell onClose={() => { setShowPin(false); onClose() }}>
        <PrintHeader title="Print Selection" quoteRef={form.quoteRef}/>
        <PINEntry
          correctPin={rates.costing_pin}
          onSuccess={() => { setPinUnlocked(true); setShowPin(false); setActiveTab('management') }}
          onCancel={() => { setShowPin(false) }}
        />
      </ModalShell>
    )
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#fff', width:'100%', maxWidth:760, maxHeight:'94vh', overflowY:'auto', borderRadius:10, boxShadow:'0 24px 80px rgba(0,0,0,.4)' }}>

        <PrintHeader title="Print / Export" quoteRef={form.quoteRef}/>

        {/* Tab selector */}
        <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', padding:'0 28px' }}>
          {[
            { id:'approval',   label:'Approval Sheet',     sub:'Sales team · 3 signatures' },
            { id:'management', label:'Management Report',  sub:'Full cost detail · PIN protected', locked: !pinUnlocked },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => tab.id === 'management' ? handleManagementTab() : setActiveTab(tab.id)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 20px', border:'none', background:'transparent', cursor:'pointer', borderBottom:`3px solid ${activeTab===tab.id?VCL_BLUE:'transparent'}`, marginBottom:-2, transition:'all .15s' }}>
              {tab.locked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              )}
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, color: activeTab===tab.id?VCL_BLUE:'#64748b' }}>{tab.label}</div>
                <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', marginTop:1 }}>{tab.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding:'22px 28px' }}>
          {activeTab === 'approval'
            ? <div id="approval-tab-body"><ApprovalContent form={form} cost={cost} style={style} board={board} isSFK={isSFK} onClose={onClose}/></div>
            : <div id="mgmt-tab-body"><ManagementContent form={form} cost={cost} style={style} board={board} isSFK={isSFK} onClose={onClose}/></div>
          }
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL CONTENT — Beautiful VCL Quotation Origination Form
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalContent({ form, cost, style, board, isSFK, onClose }) {
  const { rates } = useCosting()
  const sp  = isSFK ? parseFloat(form.sfkSellingPrice)||0 : parseFloat(form.sellingPrice)||0
  const qty = parseFloat(isSFK ? form.sfkQty : form.qty) || 0

  const L = parseFloat(form.dimL)||0
  const W = parseFloat(form.dimW)||0
  const H = parseFloat(form.dimH)||0

  const blankL    = cost?.blankLmm || 0
  const blankW    = cost?.blankWmm || 0
  const flapDepth = W > 0 ? Math.round(W/2) : 0
  const areaSqm   = cost?.blankSqm ? parseFloat(cost.blankSqm) : 0

  const layers = !isSFK && board ? (PLY_LAYERS[form.ply] || []) : []

  const paperQuality = layers.map(layer => {
    const gsm  = form[`gsm_${layer.key}`] || layer.defaultGSM
    const type = layer.role==='liner' ? (form[`type_${layer.key}`] || layer.defaultType || 'KRAFT') : null
    const lt   = type ? LINER_TYPES.find(x=>x.code===type) : null
    const suffix = lt ? (lt.name.includes('Test')?'B': lt.name.includes('Semi')?'SC': lt.name.includes('White')?'WK':'TL') : 'M'
    return `${gsm}${suffix}`
  }).join('/')

  const totalGSM      = layers.reduce((s,l) => s + (parseFloat(form[`gsm_${l.key}`] || l.defaultGSM)||0), 0)
  const wtKgPer1000   = areaSqm > 0 ? Math.round(areaSqm * totalGSM) : 0
  const wtKgPerPc     = areaSqm > 0 ? (areaSqm * totalGSM / 1000).toFixed(4) : '—'
  const totalKgRaw    = qty && wtKgPer1000 ? (qty * wtKgPer1000 / 1000).toFixed(1) : '—'
  const pricePerKg    = Math.round(rates.liner_kraft / 1000)
  const fluteCode     = form.fluteCode || 'B'
  const isStitched    = style?.join === 'Stitched'
  const isDieCut      = form.hasDieCut || style?.join === 'Glued'
  const is2Flap       = ['2FLAP_TRAY','RSC','2RSC','3RSC','FOL','OSC','HSC'].includes(form.styleCode)
  const is1Flap       = ['1FLAP_TRAY'].includes(form.styleCode)
  const isTrayType    = ['FLAT_TRAY','BLISS'].includes(form.styleCode)

  // Design tokens
  const BLK = '#0f172a'
  const MID = '#64748b'
  const BG1 = '#f8fafc'
  const BG2 = '#eef2ff'
  const ACN = VCL_BLUE
  const MONO = "'IBM Plex Mono', monospace"
  const SERIF = "'DM Serif Display', Georgia, serif"

  // Field component — label above, value with underline
  const Fld = ({label, value, flex=1, style:ext}) => (
    <div style={{flex, minWidth:0, ...ext}}>
      <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2}}>{label}</div>
      <div style={{fontSize:11, fontFamily:MONO, fontWeight:600, color:BLK, borderBottom:`1.5px solid ${ACN}`, paddingBottom:3, minHeight:20, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{value||''}</div>
    </div>
  )

  // Checkbox
  const Chk = ({checked, label}) => (
    <span style={{display:'inline-flex', alignItems:'center', gap:5, marginRight:12}}>
      <span style={{width:14, height:14, border:`1.5px solid ${checked?ACN:'#cbd5e1'}`, borderRadius:3, background:checked?ACN:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
        {checked && <span style={{color:'#fff', fontSize:9, fontWeight:900, lineHeight:1}}>✓</span>}
      </span>
      <span style={{fontSize:10, fontFamily:MONO, color:checked?BLK:MID, fontWeight:checked?600:400}}>{label}</span>
    </span>
  )

  // Table cell
  const TC = ({v, bold, bg, border=true}) => (
    <td style={{padding:'6px 10px', textAlign:'center', fontSize:bold?13:11, fontFamily:bold?SERIF:MONO, fontWeight:bold?700:400, color:bold?ACN:BLK, background:bg||'transparent', borderRight:border?`1px solid #e2e8f0`:'none'}}>
      {v||'—'}
    </td>
  )

  return (
    <div style={{background:'#fff', fontFamily:MONO}}>

      {/* ══ DOCUMENT ══════════════════════════════════════════════ */}
      <div style={{maxWidth:700, margin:'0 auto'}}>

        {/* ── HEADER ── */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'stretch', marginBottom:20, gap:0, border:`2px solid ${ACN}`, borderRadius:10, overflow:'hidden'}}>
          {/* Left: branding */}
          <div style={{background:ACN, padding:'16px 20px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:220}}>
            <div>
              <div style={{fontFamily:SERIF, fontSize:22, color:'#fff', letterSpacing:'.01em', lineHeight:1.1}}>VIMIT<br/>CONVERTERS</div>
              <div style={{fontSize:8, color:'rgba(255,255,255,.6)', fontFamily:MONO, marginTop:4, letterSpacing:'.08em', textTransform:'uppercase'}}>Limited · Nairobi, Kenya</div>
            </div>
            <div style={{marginTop:12}}>
              <div style={{fontSize:8, color:'rgba(255,255,255,.5)', fontFamily:MONO, letterSpacing:'.06em'}}>+254 746 506 802</div>
              <div style={{fontSize:8, color:'rgba(255,255,255,.5)', fontFamily:MONO}}>info@vimit.com</div>
            </div>
          </div>
          {/* Centre: title + SR */}
          <div style={{flex:1, padding:'16px 20px', display:'flex', flexDirection:'column', justifyContent:'space-between', background:BG2}}>
            <div>
              <div style={{fontSize:8, fontFamily:MONO, color:MID, letterSpacing:'.12em', textTransform:'uppercase', marginBottom:4}}>Internal Document</div>
              <div style={{fontFamily:SERIF, fontSize:18, color:ACN, lineHeight:1.1}}>Quotation<br/>Origination</div>
            </div>
            <div style={{display:'flex', gap:16, marginTop:8}}>
              <div>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em'}}>SR Number</div>
                <div style={{fontSize:13, fontFamily:MONO, fontWeight:700, color:BLK}}>{form.quoteRef?.replace('VCL-CQ-','') || '—'}</div>
              </div>
              <div>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em'}}>Date</div>
                <div style={{fontSize:13, fontFamily:MONO, fontWeight:700, color:BLK}}>{todayStr()}</div>
              </div>
              <div>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em'}}>Due Date</div>
                <div style={{fontSize:13, fontFamily:MONO, fontWeight:700, color:BLK}}>{form.validUntil||'—'}</div>
              </div>
            </div>
          </div>
          {/* Right: reel / sheet info */}
          <div style={{padding:'16px 16px', background:'#fff', minWidth:150, borderLeft:`1px solid #e2e8f0`}}>
            <div style={{fontSize:8, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8}}>Board Ref</div>
            {[['Reel Width',blankW?blankW+' mm':''],['Cut Length',blankL?blankL+' mm':''],['Flute',fluteCode],['Ply',form.ply||3]].map(([k,v])=>(
              <div key={k} style={{marginBottom:5}}>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em'}}>{k}</div>
                <div style={{fontSize:11, fontFamily:MONO, fontWeight:600, color:BLK}}>{v||'—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION A: Customer & Order ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:ACN, letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>A — Customer &amp; Order Details</div>
          <div style={{border:`1.5px solid ${ACN}`, borderRadius:'0 6px 6px 6px', padding:14, display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:'flex', gap:12}}>
              <Fld label="Customer Name" value={form.customer} flex={2}/>
              <Fld label="Sales Representative" value={form.preparedBy} flex={1}/>
              <Fld label="New / Repeat" value="NEW" flex={0.5}/>
            </div>
            <div style={{display:'flex', gap:12}}>
              <Fld label="Job Description" value={form.productDesc} flex={2}/>
              <Fld label="Customer Ref" value={form.remarks||''} flex={1}/>
              <Fld label="Payment Terms" value={form.paymentTerms} flex={1}/>
            </div>
            <div style={{display:'flex', gap:12}}>
              <Fld label="Colours / Printing" value={+form.inkColours>0?form.inkColours+' Colour(s)':'Plain (Unprinted)'} flex={1}/>
              <Fld label="Qty Ordered" value={qty?qty.toLocaleString()+' pcs':''} flex={1}/>
              <Fld label="Actual Qty" value="" flex={1}/>
              <div style={{flex:0.5}}>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6}}>Ply</div>
                <div style={{display:'flex', gap:6}}>
                  {['3','5'].map(p=>(
                    <span key={p} style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, border:`1.5px solid ${form.ply===p?ACN:'#e2e8f0'}`, borderRadius:6, background:form.ply===p?ACN:'#fff', fontSize:12, fontFamily:MONO, fontWeight:700, color:form.ply===p?'#fff':MID}}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION B: Product Specification ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:'#1e40af', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>B — Product Specification</div>
          <div style={{border:'1.5px solid #1e40af', borderRadius:'0 6px 6px 6px', padding:14}}>
            {/* Dimensions + Type */}
            <div style={{display:'flex', gap:12, marginBottom:12, alignItems:'flex-end'}}>
              <div>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6}}>Internal Dimensions (mm)</div>
                <div style={{display:'flex', gap:8}}>
                  {[['L',form.dimL],['W',form.dimW],['H',form.dimH]].map(([dim,val])=>(
                    <div key={dim} style={{textAlign:'center'}}>
                      <div style={{fontSize:8, fontFamily:MONO, color:MID, marginBottom:2}}>{dim}</div>
                      <div style={{width:56, height:32, border:`1.5px solid ${ACN}`, borderRadius:6, background:BG2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontFamily:MONO, fontWeight:700, color:ACN}}>{val||''}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6}}>Box Type</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                  <Chk checked={is2Flap} label="2 Flap RSC"/>
                  <Chk checked={is1Flap} label="1 Flap RSC"/>
                  <Chk checked={isTrayType} label="Tray (FTD)"/>
                </div>
              </div>
              <div>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6}}>Process</div>
                <div style={{display:'flex', gap:4}}>
                  <Chk checked={isStitched} label="Stitched"/>
                  <Chk checked={isDieCut} label="Die-Cut"/>
                </div>
              </div>
            </div>

            {/* Paper quality */}
            <div style={{display:'flex', gap:12, marginBottom:12}}>
              <Fld label="Paper Quality Combination" value={paperQuality||'—'} flex={2}/>
              <Fld label="Flute Type" value={fluteCode} flex={0.5}/>
              <Fld label="Printing Plate Cost" value={+form.inkColours>0?'As quoted':'N/A'} flex={1}/>
              <Fld label="Plain / Coloured" value={+form.inkColours>0?'COLOURED':'PLAIN'} flex={1}/>
            </div>

            {/* Board sizes */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:8}}>
              {[['Board Width (mm)',blankW],['Board Length (mm)',blankL],['CTN Flap (mm)',flapDepth],['CTN Height (mm)',H],['Price of Paper / KG','KES '+pricePerKg]].map(([k,v])=>(
                <div key={k} style={{background:BG1, border:'1px solid #e2e8f0', borderRadius:6, padding:'7px 9px'}}>
                  <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3}}>{k}</div>
                  <div style={{fontSize:12, fontFamily:MONO, fontWeight:700, color:BLK}}>{v||'—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SECTION C: Panel & Flap Dimensions ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:'#0f766e', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>C — Panel &amp; Flap Dimensions (Creasing Layout)</div>
          <div style={{border:'1.5px solid #0f766e', borderRadius:'0 6px 6px 6px', overflow:'hidden'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#0f766e'}}>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'left', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>Type</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>Flap</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>H</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>Flap</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>B.W</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase', borderRight:'1px solid rgba(255,255,255,.2)'}}>B.L</th>
                  <th style={{padding:'8px 10px', fontFamily:MONO, fontSize:9, color:'#fff', fontWeight:600, textAlign:'center', letterSpacing:'.06em', textTransform:'uppercase'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {/* Flap row */}
                <tr style={{background:BG1}}>
                  <td style={{padding:'10px 10px', borderRight:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em'}}>Area SQM</div>
                    <div style={{fontSize:14, fontFamily:SERIF, fontWeight:700, color:'#0f766e', marginTop:2}}>{areaSqm.toFixed(4)}</div>
                    <div style={{marginTop:6, fontSize:10, fontFamily:MONO, fontWeight:700, color:BLK}}>FLAP</div>
                  </td>
                  {[flapDepth, H, flapDepth, W, '—', blankW].map((v,i)=>(
                    <td key={i} style={{padding:'10px 10px', textAlign:'center', fontSize:13, fontFamily:SERIF, fontWeight:700, color:BLK, borderRight:i<5?'1px solid #e2e8f0':'none', borderBottom:'1px solid #e2e8f0', background:i===5?BG2:'transparent'}}>{v||'—'}</td>
                  ))}
                </tr>
                {/* Panel row */}
                <tr>
                  <td style={{padding:'10px 10px', borderRight:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em'}}>W.T KG / 1000</div>
                    <div style={{fontSize:14, fontFamily:SERIF, fontWeight:700, color:'#0f766e', marginTop:2}}>{wtKgPer1000||'—'}</div>
                    <div style={{marginTop:6, fontSize:10, fontFamily:MONO, fontWeight:700, color:BLK}}>PANEL</div>
                  </td>
                  {[L, W, L, W, 30, blankL].map((v,i)=>(
                    <td key={i} style={{padding:'10px 10px', textAlign:'center', fontSize:13, fontFamily:SERIF, fontWeight:700, color:BLK, borderRight:i<5?'1px solid #e2e8f0':'none', background:i===5?BG2:'transparent'}}>{v||'—'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION D: Production Summary ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:'#7c3aed', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>D — Production Summary</div>
          <div style={{border:'1.5px solid #7c3aed', borderRadius:'0 6px 6px 6px', padding:14}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:12}}>
              {[
                ['Weight / Piece (kg)', wtKgPerPc],
                ['Board Surface Area (m²)', areaSqm.toFixed(4)],
                ['Total KG for Production', totalKgRaw+' KGS'],
                ['CTN Unit Weight', wtKgPerPc],
              ].map(([k,v])=>(
                <div key={k} style={{background:BG1, border:'1px solid #e2e8f0', borderRadius:7, padding:'9px 11px'}}>
                  <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3}}>{k}</div>
                  <div style={{fontSize:13, fontFamily:SERIF, fontWeight:700, color:'#7c3aed'}}>{v||'—'}</div>
                </div>
              ))}
            </div>
            {/* Ply checkboxes */}
            <div style={{display:'flex', gap:4, alignItems:'center', marginBottom:10}}>
              <span style={{fontSize:8, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginRight:8}}>Ply Config:</span>
              {[['1 PLY','1'],['2 PLY','2'],['3 PLY','3'],['5 PLY','5']].map(([l,p])=><Chk key={p} checked={form.ply===p} label={l}/>)}
            </div>
            {/* Bundling */}
            <div style={{display:'flex', gap:4, alignItems:'center'}}>
              <span style={{fontSize:8, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em', marginRight:8}}>Bundling:</span>
              {[['Set PCS 25',true],['Actual',false],['Excess',false],['Set PCS 50',false]].map(([l,c])=><Chk key={l} checked={c} label={l}/>)}
            </div>
          </div>
        </div>

        {/* ── SECTION E: Pricing ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:'#b45309', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>E — Pricing</div>
          <div style={{border:'1.5px solid #b45309', borderRadius:'0 6px 6px 6px', padding:14}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
              <div style={{background:ACN, borderRadius:8, padding:'14px 16px'}}>
                <div style={{fontSize:8, fontFamily:MONO, color:'rgba(255,255,255,.65)', textTransform:'uppercase', letterSpacing:'.08em'}}>Unit Price (excl. VAT)</div>
                <div style={{fontSize:24, fontFamily:SERIF, color:'#fff', marginTop:6}}>{sp?`KES ${fmt(sp)}`:'—'}</div>
                <div style={{fontSize:9, fontFamily:MONO, color:'rgba(255,255,255,.6)', marginTop:3}}>per {cost.unitLabel}</div>
              </div>
              <div style={{background:BG1, border:'1.5px solid #e2e8f0', borderRadius:8, padding:'14px 16px'}}>
                <div style={{fontSize:8, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.08em'}}>Quantity</div>
                <div style={{fontSize:24, fontFamily:SERIF, color:BLK, marginTop:6}}>{qty?qty.toLocaleString():'—'}</div>
                <div style={{fontSize:9, fontFamily:MONO, color:MID, marginTop:3}}>{cost.qtyLabel}</div>
              </div>
              <div style={{background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:8, padding:'14px 16px'}}>
                <div style={{fontSize:8, fontFamily:MONO, color:'#15803d', textTransform:'uppercase', letterSpacing:'.08em'}}>Total Value (excl. VAT)</div>
                <div style={{fontSize:24, fontFamily:SERIF, color:'#15803d', marginTop:6}}>{sp&&qty?`KES ${fmt(sp*qty)}`:'—'}</div>
                <div style={{fontSize:9, fontFamily:MONO, color:'#15803d', marginTop:3}}>+ 16% VAT where applicable</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION F: Approval Signatures ── */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8, fontFamily:MONO, color:'#fff', background:'#be123c', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600, padding:'4px 10px', borderRadius:'4px 4px 0 0', display:'inline-block'}}>F — Approval Signatures</div>
          <div style={{border:'1.5px solid #be123c', borderRadius:'0 6px 6px 6px', overflow:'hidden'}}>
            <div style={{padding:'10px 14px', background:'#fff1f2', borderBottom:'1px solid #fecdd3'}}>
              <div style={{fontSize:10, fontFamily:MONO, color:'#9f1239'}}>All three parties must sign before this quotation is issued to the customer. CFO/MD signature is mandatory when the quoted price falls below the approved margin floor.</div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr'}}>
              {[
                {num:'01', role:'Sales Representative', color:'#1e40af', bg:'#eff6ff', required:false},
                {num:'02', role:'Sales Manager',        color:'#0f766e', bg:'#f0fdfa', required:false},
                {num:'03', role:'CFO / MD',             color:'#be123c', bg: cost.approvalRequired?'#fff1f2':'#fff', required:cost.approvalRequired},
              ].map((s,i) => (
                <div key={s.role} style={{padding:'16px 16px 14px', background:s.bg, borderRight:i<2?'1px solid #e2e8f0':'none'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
                    <div style={{fontSize:8, fontFamily:MONO, color:s.color, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:700}}>{s.num} — {s.role}</div>
                    {s.required && <span style={{fontSize:7.5, fontFamily:MONO, background:'#f59e0b', color:'#fff', padding:'2px 7px', borderRadius:20, fontWeight:700, letterSpacing:'.04em'}}>REQUIRED</span>}
                  </div>
                  {['Name','Signature','Date'].map((f,fi) => (
                    <div key={f} style={{marginBottom:fi<2?14:0}}>
                      <div style={{fontSize:8, fontFamily:MONO, color:MID, marginBottom:3, letterSpacing:'.04em'}}>{f}</div>
                      <div style={{borderBottom:`1.5px solid ${s.required?'#f59e0b':s.color}`, minHeight:f==='Signature'?36:22, opacity:.7}}/>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Management Remarks ── */}
        <div style={{border:'1.5px solid #e2e8f0', borderRadius:8, padding:14, marginBottom:14, background:BG1}}>
          <div style={{fontSize:8, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.1em', fontWeight:600, marginBottom:10}}>Management Remarks</div>
          <div style={{borderBottom:'1px solid #cbd5e1', minHeight:28, marginBottom:12}}/>
          <div style={{display:'flex', gap:10}}>
            {[['Reel Size',blankW?blankW+' mm':''],['UPS',''],['GSM',paperQuality||''],['Sheet','']].map(([k,v])=>(
              <div key={k} style={{flex:1}}>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3}}>{k}</div>
                <div style={{fontSize:11, fontFamily:MONO, fontWeight:600, color:BLK, borderBottom:'1px solid #cbd5e1', paddingBottom:3, minHeight:20}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex', gap:10, marginTop:10}}>
            {[['Approved By',''],['Date',''],['Signature','']].map(([k,v])=>(
              <div key={k} style={{flex:1}}>
                <div style={{fontSize:7.5, fontFamily:MONO, color:MID, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3}}>{k}</div>
                <div style={{borderBottom:'1px solid #cbd5e1', minHeight:28}}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid #e2e8f0'}}>
          <div style={{fontSize:8, fontFamily:MONO, color:MID}}>OFFICE LINE: +254 746 506 802 · info@vimit.com · OFF MOMBASA ROAD (WEST OF JKIA) · P.O BOX 18560-00500, NAIROBI</div>
          <div style={{fontSize:8, fontFamily:MONO, color:MID}}>Generated {todayStr()}</div>
        </div>
      </div>

      {/* ── Buttons ── */}
      <div style={{display:'flex', gap:10, justifyContent:'flex-end', marginTop:20}}>
        <button onClick={onClose} style={{padding:'10px 20px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:6, fontSize:12, fontFamily:MONO, cursor:'pointer', color:MID}}>Close</button>
        <button onClick={() => doPrint('approval-tab-body', {form,cost,style,board,isSFK,rates})} style={{padding:'10px 24px', background:ACN, border:'none', borderRadius:6, fontSize:12, fontFamily:MONO, cursor:'pointer', color:'#fff', fontWeight:600}}>Print Quotation Origination Form</button>
      </div>
    </div>
  )
}

function ManagementContent({ form, cost, style, board, isSFK, onClose }) {
  const { rates } = useCosting()
  const sc = STATUS_CONFIG[cost.priceStatus]
  const sp = isSFK ? parseFloat(form.sfkSellingPrice)||0 : parseFloat(form.sellingPrice)||0
  const qty = parseFloat(isSFK ? form.sfkQty : form.qty) || 0
  const layers = !isSFK && board ? PLY_LAYERS[form.ply] || [] : []

  return (
    <div>
      <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'8px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:VCL_RED, flexShrink:0 }}/>
        <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#b91c1c', fontWeight:600, letterSpacing:'.04em' }}>CONFIDENTIAL — Management only · Not for distribution</span>
      </div>

      <MetaGrid items={[['Date',todayStr()],['Prepared By',form.preparedBy],['Customer',form.customer],['Product',form.productDesc],['Valid Until',form.validUntil],['Payment Terms',form.paymentTerms]]}/>

      {!isSFK && form.dimL && form.dimW && form.dimH && (
        <>
          <SectionTitle>Blank Layout</SectionTitle>
          <div style={{ padding:12, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:4 }}>
            <FlatLayout styleCode={form.styleCode} dimL={form.dimL} dimW={form.dimW} dimH={form.dimH} blankLmm={cost.blankLmm} blankWmm={cost.blankWmm}/>
          </div>
        </>
      )}

      {/* Board GSM breakdown */}
      {!isSFK && layers.length > 0 && (
        <>
          <SectionTitle>Board Build — GSM per Layer</SectionTitle>
          <div style={{ display:'flex', gap:0, border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', marginBottom:4 }}>
            {layers.map((layer, i) => {
              const gsm = form[`gsm_${layer.key}`] || layer.defaultGSM
              const type = layer.role==='liner' ? (form[`type_${layer.key}`]||layer.defaultType) : null
              const lt = type ? LINER_TYPES.find(x=>x.code===type) : null
              return (
                <div key={layer.key} style={{ flex:1, padding:'8px 10px', background:layer.role==='liner'?'#f0f4ff':'#fffbeb', borderRight:i<layers.length-1?'1px solid #e2e8f0':'none', textAlign:'center' }}>
                  <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{layer.label}</div>
                  <div style={{ fontSize:14, fontFamily:"'DM Serif Display',Georgia,serif", color:layer.role==='liner'?VCL_BLUE:'#92400e' }}>{gsm} GSM</div>
                  {lt && <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#64748b', marginTop:1 }}>{lt.name}</div>}
                </div>
              )
            })}
          </div>
        </>
      )}

      <SectionTitle>Cost Build-Up</SectionTitle>
      <table style={{ width:'100%', borderCollapse:'collapse', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', marginBottom:4 }}>
        <thead><tr style={{ background:VCL_BLUE }}>
          {['Cost Element',`Per ${cost.unitLabel}`,'Total','% Total'].map((h,i)=>(
            <th key={h} style={{ padding:'7px 10px', textAlign:i===0?'left':'right', fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#fff', letterSpacing:'.08em', textTransform:'uppercase' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {cost.rows.map((r,i) => (
            <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'#fff':'#fafbff' }}>
              <td style={{ padding:'6px 10px', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>{r.label}</td>
              <td style={{ padding:'6px 10px', textAlign:'right', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>KES {fmt(r.each)}</td>
              <td style={{ padding:'6px 10px', textAlign:'right', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#475569' }}>KES {fmt(r.tot)}</td>
              <td style={{ padding:'6px 10px', textAlign:'right', fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8' }}>{cost.fullTot>0?(r.tot/cost.fullTot*100).toFixed(1):0}%</td>
            </tr>
          ))}
          <tr style={{ borderTop:'2px solid '+VCL_BLUE, background:'#f0f4ff' }}>
            <td style={{ padding:'9px 10px', fontFamily:"'DM Serif Display',Georgia,serif", fontSize:13, color:VCL_BLUE, fontWeight:600 }}>Full Cost</td>
            <td style={{ padding:'9px 10px', textAlign:'right', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE, fontWeight:700 }}>KES {fmt(cost.fullEach)}</td>
            <td style={{ padding:'9px 10px', textAlign:'right', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE, fontWeight:700 }}>KES {fmt(cost.fullTot)}</td>
            <td style={{ padding:'9px 10px', textAlign:'right', fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:VCL_BLUE }}>100%</td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>Pricing Analysis</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        {[
          {k:'Full Cost',    v:`KES ${fmt(cost.fullEach)}`,   bg:'#f8fafc', border:'#e2e8f0', text:'#1e293b'},
          {k:'Floor Price',  v:`KES ${fmt(cost.floorEach)}`,  bg:'#fff7ed', border:'#fed7aa', text:'#c2410c'},
          {k:'Target Price', v:`KES ${fmt(cost.targetEach)}`, bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d'},
          {k:'Quoted Price', v:sp?`KES ${fmt(sp)}`:'Not set', bg:sc.bg, border:sc.border+'44', text:sc.text},
        ].map(r=>(
          <div key={r.k} style={{ background:r.bg, border:`1.5px solid ${r.border}`, borderRadius:7, padding:'10px 12px' }}>
            <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:r.text, textTransform:'uppercase', letterSpacing:'.06em', opacity:.8 }}>{r.k}</div>
            <div style={{ fontSize:14, fontFamily:"'DM Serif Display',Georgia,serif", color:r.text, marginTop:3 }}>{r.v}</div>
          </div>
        ))}
      </div>

      {cost.marginPct!=null && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:sc.bg, border:`1.5px solid ${sc.border}`, borderRadius:6, marginBottom:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:sc.dot, flexShrink:0 }}/>
          <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, fontWeight:600 }}>{sc.label}</span>
          <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, marginLeft:12 }}>Margin: <strong>{fmt(cost.marginPct,1)}%</strong></span>
          {sp&&qty&&<span style={{ fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:sc.text, marginLeft:12 }}>Total Revenue: <strong>KES {fmt(sp*qty)}</strong></span>}
        </div>
      )}

      <SectionTitle>Rates Applied</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:cost.approvalRequired?12:14 }}>
        {[['Overhead',rates.overhead_pct+'%'],['Slotter','KES '+Number(rates.slotter_rate).toLocaleString()+'/hr'],['Labour','KES '+Number(rates.labour_hourly).toLocaleString()+'/hr'],['Efficiency',rates.efficiency_pct+'%'],['Floor Margin',rates.margin_floor+'%']].map(([k,v])=>(
          <div key={k} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'7px 9px', textAlign:'center' }}>
            <div style={{ fontSize:8, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{k}</div>
            <div style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#1e293b', fontWeight:600 }}>{v}</div>
          </div>
        ))}
      </div>

      {cost.approvalRequired && (
        <div style={{ border:'2px solid #f59e0b', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
          <div style={{ background:'#f59e0b', padding:'7px 14px' }}>
            <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#fff', fontWeight:700, letterSpacing:'.06em' }}>MANAGEMENT APPROVAL REQUIRED — Price below {rates.margin_floor}% floor</span>
          </div>
          <div style={{ padding:'14px 16px', display:'flex', gap:24 }}>
            <SignatureLine role="CFO / Financial Authority"/>
            <SignatureLine role="MD / Commercial Authority"/>
          </div>
        </div>
      )}

      {form.remarks && (
        <div style={{ padding:'9px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginBottom:12 }}>
          <div style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Remarks</div>
          <div style={{ fontSize:11, color:'#475569', fontFamily:"'IBM Plex Mono',monospace" }}>{form.remarks}</div>
        </div>
      )}

      <div style={{ fontSize:9, color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace", textAlign:'center', paddingTop:10, borderTop:'1px solid #e2e8f0', marginBottom:16 }}>
        CONFIDENTIAL MANAGEMENT DOCUMENT · Not for external distribution · Prices exclude VAT · {todayStr()}
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={{ padding:'10px 20px', border:'1.5px solid #e2e8f0', background:'#fff', borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', color:'#64748b' }}>Close</button>
        <button onClick={() => doPrint('management', {form,cost,style,board,isSFK,rates})} style={{ padding:'10px 24px', background:VCL_BLUE, border:'none', borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', color:'#fff', fontWeight:600 }}>Print Management Report</button>
      </div>
    </div>
  )
}
