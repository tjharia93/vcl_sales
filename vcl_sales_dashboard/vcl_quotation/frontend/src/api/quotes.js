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
  if (payload === undefined || payload === null) {
    throw new Error('Empty response from ' + method)
  }
  // Our own whitelist methods return { status:'ok'|'error', data | message }.
  // Frappe-native methods (e.g. `frappe.client.get_list`) return the value
  // directly under `.message`, so pass those through untouched.
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.status === 'error') {
      throw new Error(payload.message || 'API error')
    }
    if (payload.status === 'ok') {
      return payload.data
    }
  }
  return payload
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

// Lifecycle (QUOT note: Submit/Cancel/Amend) — Sales Manager+ only.
export async function apiSubmitQuote(id) {
  return frappeCall({ method: `${METHOD}.submit_quote`, args: { name: id } })
}

export async function apiCancelQuote(id) {
  return frappeCall({ method: `${METHOD}.cancel_quote`, args: { name: id } })
}

export async function apiAmendQuote(id) {
  return frappeCall({ method: `${METHOD}.amend_quote`, args: { name: id } })
}

// Customer typeahead. Uses Frappe's built-in `frappe.client.get_list` so we
// don't need a bespoke whitelist on our side. Match by either `name` (the
// Customer record id) or `customer_name` (the human-readable field) so reps
// can type the casual name and still find the record.
export async function apiSearchCustomers(term) {
  if (!term || term.length < 2) return []
  const filters = [
    ['Customer', 'customer_name', 'like', '%' + term + '%'],
  ]
  const data = await frappeCall({
    method: 'frappe.client.get_list',
    type: 'GET',
    args: {
      doctype: 'Customer',
      filters: JSON.stringify(filters),
      fields: JSON.stringify(['name', 'customer_name']),
      limit_page_length: 8,
      order_by: 'customer_name asc',
    },
  })
  // `frappe.client.get_list` returns the array directly under `.message`,
  // not under `.message.data`, so our `unwrap` will hand us back `null` for
  // the data envelope. Re-shape gracefully.
  return Array.isArray(data) ? data : []
}
