// ─────────────────────────────────────────────────────────────────────────────
// VCL QUOTATION — API CLIENT (Frappe whitelist)
// All calls hit `vcl_sales_dashboard.vcl_quotation.api.*` whitelisted methods.
// Prefers `frappe.call` (loaded by frappe-web.bundle on the www route); falls
// back to a same-origin fetch against `/api/method/...` with the CSRF cookie
// when the bundle has not loaded yet (e.g. early in app startup or Vite dev).
// Response envelope: { status: 'ok' | 'error', data?, message? }
// ─────────────────────────────────────────────────────────────────────────────

const METHOD = 'vcl_sales_dashboard.vcl_quotation.api'

function getCsrfToken() {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  if (m) return decodeURIComponent(m[1])
  if (window.frappe && window.frappe.csrf_token) return window.frappe.csrf_token
  return ''
}

function unwrap(payload, method) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty response from ' + method)
  }
  if (payload.status === 'error') {
    throw new Error(payload.message || 'API error')
  }
  return payload.data
}

function callViaFrappe({ method, args, type }) {
  return new Promise((resolve, reject) => {
    window.frappe.call({
      method,
      args: args || {},
      type: type || 'POST',
      callback: (r) => {
        try { resolve(unwrap(r && r.message, method)) }
        catch (e) { reject(e) }
      },
      error: (xhr) => {
        const msg = (xhr && xhr.responseText) ? xhr.responseText : 'Request failed'
        reject(new Error(msg))
      },
    })
  })
}

async function callViaFetch({ method, args, type }) {
  const isGet = (type || 'POST').toUpperCase() === 'GET'
  const headers = {
    'Accept': 'application/json',
    'X-Frappe-CSRF-Token': getCsrfToken(),
  }
  let url = '/api/method/' + method
  let init = { method: isGet ? 'GET' : 'POST', credentials: 'same-origin', headers }
  if (isGet) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(args || {})) {
      if (v === undefined || v === null) continue
      params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
    }
    const q = params.toString()
    if (q) url += '?' + q
  } else {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(args || {})
  }
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(method + ' returned HTTP ' + r.status)
  const json = await r.json()
  // Frappe wraps whitelisted return values under .message
  return unwrap(json.message ?? json, method)
}

function frappeCall(opts) {
  if (typeof window !== 'undefined' && window.frappe && typeof window.frappe.call === 'function') {
    return callViaFrappe(opts)
  }
  return callViaFetch(opts)
}

export async function apiGetQuotes() {
  return frappeCall({ method: `${METHOD}.get_quote_list`, type: 'GET' })
}

export async function apiGetQuote(id) {
  return frappeCall({ method: `${METHOD}.get_quote`, args: { name: id }, type: 'GET' })
}

export async function apiSaveQuote(formData) {
  const { costRows, ...form } = formData || {}
  return frappeCall({
    method: `${METHOD}.save_quote`,
    args: { form, cost_rows: costRows || [] },
  })
}

export async function apiUpdateStatus(id, status) {
  return frappeCall({
    method: `${METHOD}.update_quote_status`,
    args: { name: id, status },
  })
}

export async function apiNextRef() {
  return frappeCall({ method: `${METHOD}.next_ref`, type: 'GET' })
}

export async function apiGetCostingSettings() {
  return frappeCall({ method: `${METHOD}.get_costing_settings`, type: 'GET' })
}

export async function apiUpdateCostingSettings(rates) {
  return frappeCall({
    method: `${METHOD}.update_costing_settings`,
    args: { rates },
  })
}
