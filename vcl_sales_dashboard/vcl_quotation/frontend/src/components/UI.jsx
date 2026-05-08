import { useState } from 'react'
import { apiNextRef } from '../api/quotes.js'

export function SectionHeader({ number, title, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:16, paddingBottom:10, borderBottom:'2px solid #e2e8f0' }}>
      <span style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:24, color:'#2B3990', lineHeight:1 }}>{number}</span>
      <div>
        <div style={{ fontFamily:"'DM Serif Display',Georgia,serif", fontSize:14, color:'#1e293b' }}>{title}</div>
        {sub && <div style={{ fontSize:10, color:'#94a3b8', fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function FieldLabel({ label, hint, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10, color:'#64748b', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:4, fontFamily:"'IBM Plex Mono',monospace" }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:10, color:'#94a3b8', marginTop:3, fontFamily:"'IBM Plex Mono',monospace" }}>{hint}</div>}
    </div>
  )
}

const baseInput = { width:'100%', padding:'8px 11px', border:'1.5px solid #e2e8f0', borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", color:'#1e293b', background:'#fff', outline:'none', transition:'border-color .15s', boxSizing:'border-box' }

export function TextInput({ value, onChange, type='text', placeholder, step, min }) {
  const [focused, setFocused] = useState(false)
  return (
    <input type={type} value={value} placeholder={placeholder} step={step} min={min}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...baseInput, borderColor: focused ? '#2B3990' : '#e2e8f0' }}
    />
  )
}

export function SelectInput({ value, onChange, children }) {
  const [focused, setFocused] = useState(false)
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ ...baseInput, appearance:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', paddingRight:28,
        cursor:'pointer', borderColor: focused ? '#2B3990' : '#e2e8f0' }}>
      {children}
    </select>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 11px', border:`1.5px solid ${checked?'#2B3990':'#e2e8f0'}`, borderRadius:6, cursor:'pointer', background:checked?'#f0f4ff':'#fff', userSelect:'none', transition:'all .15s' }}>
      <div style={{ width:13, height:13, borderRadius:'50%', border:`2px solid ${checked?'#2B3990':'#cbd5e1'}`, background:checked?'#2B3990':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {checked && <div style={{ width:4, height:4, borderRadius:'50%', background:'#fff' }} />}
      </div>
      <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:checked?'#2B3990':'#64748b', fontWeight:checked?600:400 }}>{label}</span>
    </div>
  )
}

export function PlyButton({ label, sub, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:'12px', border:`2px solid ${active?'#2B3990':'#e2e8f0'}`, borderRadius:8, background:active?'#2B3990':'#fff', cursor:'pointer', textAlign:'center', transition:'all .15s' }}>
      <div style={{ fontSize:15, fontFamily:"'DM Serif Display',Georgia,serif", color:active?'#fff':'#1e293b' }}>{label}</div>
      <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", color:active?'rgba(255,255,255,.7)':'#94a3b8', marginTop:2 }}>{sub}</div>
    </button>
  )
}

export function Card({ children, borderColor, style: extra }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:22, marginBottom:14, border:`1px solid ${borderColor||'#e2e8f0'}`, ...extra }}>
      {children}
    </div>
  )
}

export function InfoStrip({ items }) {
  return (
    <div style={{ display:'flex', gap:20, padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, marginTop:10, flexWrap:'wrap' }}>
      {items.map(([k,v]) => (
        <div key={k}>
          <div style={{ fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.08em', fontFamily:"'IBM Plex Mono',monospace", marginBottom:2 }}>{k}</div>
          <div style={{ fontSize:12, color:'#1e293b', fontWeight:600, fontFamily:"'IBM Plex Mono',monospace" }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

export const fmt      = (n, d=2) => n==null ? '—' : Number(n).toLocaleString('en-KE',{minimumFractionDigits:d,maximumFractionDigits:d})
export const todayStr = () => new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
export const genRef   = () => `VCL-CQ-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000+1000))}`

// Fetch next sequential ref from the Frappe API. Falls back to a random ref
// if the call fails (e.g. local dev without a Frappe bench attached).
export async function fetchNextRef() {
  try {
    const data = await apiNextRef()
    return (data && data.ref) || genRef()
  } catch {
    return genRef()
  }
}
export const GRID    = { two:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}, three:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}, four:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12} }
