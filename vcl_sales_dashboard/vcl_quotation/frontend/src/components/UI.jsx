import { useState, useEffect, useRef } from 'react'
import { apiNextRef, apiSearchCustomers } from '../api/quotes.js'

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

// Customer autocomplete — typeahead against ERPNext Customer master.
// Free-text on Enter / blur is the design contract: if the typed string
// matches a Customer record, the server links it; otherwise it lands in
// `customer_text` only. Reps are never blocked by missing master records.
export function CustomerAutocomplete({ value, onChange, placeholder='Customer / Account' }) {
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const debounce = useRef(null)

  useEffect(() => {
    if (!focused) return
    const term = (value || '').trim()
    if (term.length < 2) { setResults([]); setOpen(false); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        const list = await apiSearchCustomers(term)
        setResults(list || [])
        setOpen((list || []).length > 0)
        setHighlight(0)
      } catch {
        setResults([]); setOpen(false)
      }
    }, 200)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [value, focused])

  const pick = (item) => {
    onChange(item.name)
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); pick(results[highlight]) }
    else if (e.key === 'Escape')    { setOpen(false) }
  }

  return (
    <div style={{ position:'relative' }}>
      <input
        value={value || ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 120) }}
        onKeyDown={onKeyDown}
        style={{ ...baseInput, borderColor: focused ? '#2B3990' : '#e2e8f0' }}
      />
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #2B3990', borderTop:'none', borderRadius:'0 0 6px 6px', boxShadow:'0 8px 18px rgba(15,23,42,.12)', zIndex:50, maxHeight:240, overflowY:'auto' }}>
          {results.map((r, i) => (
            <div
              key={r.name}
              onMouseDown={(e) => { e.preventDefault(); pick(r) }}
              onMouseEnter={() => setHighlight(i)}
              style={{ padding:'8px 11px', fontSize:11, fontFamily:"'IBM Plex Mono',monospace", cursor:'pointer', background: i === highlight ? '#f0f4ff' : '#fff', borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none' }}
            >
              <div style={{ color:'#1e293b', fontWeight:600 }}>{r.customer_name || r.name}</div>
              {r.customer_name && r.name !== r.customer_name && (
                <div style={{ color:'#94a3b8', fontSize:9, marginTop:2 }}>{r.name}</div>
              )}
            </div>
          ))}
          <div style={{ padding:'6px 11px', fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:'#94a3b8', background:'#f8fafc', borderTop:'1px solid #f1f5f9' }}>
            ↵ to pick · Enter your own name to keep it as free text
          </div>
        </div>
      )}
    </div>
  )
}

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
// Use auto-fit / minmax so multi-column groups collapse to fewer columns on
// narrow viewports instead of overflowing the screen.
export const GRID    = {
  two:  {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12},
  three:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12},
  four: {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12},
}
