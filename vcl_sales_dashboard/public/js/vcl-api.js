/**
 * VCL Sales Dashboard - Shared API & Utility Module
 *
 * Provides CSRF-safe fetch wrappers, formatting helpers, and
 * common UI utilities for all VCL dashboard pages.
 *
 * Usage:
 *   await VCL.fetchCsrfToken();          // call once on page load
 *   const data = await VCL.api('vcl_sales_dashboard.api.some_method', { arg: 1 });
 *   VCL.showMsg('Saved!', 'success', 3000);
 */
var VCL = (function () {
  'use strict';

  var _csrfToken = '';

  // ----------------------------------------------------------
  // CSRF helpers
  // ----------------------------------------------------------

  /**
   * Return the best available CSRF token synchronously.
   * Checks (in order): cached token, frappe global, cookie.
   */
  function getCsrfToken() {
    if (_csrfToken) {
      return _csrfToken;
    }
    if (typeof frappe !== 'undefined' && frappe.csrf_token) {
      _csrfToken = frappe.csrf_token;
      return _csrfToken;
    }
    var match = document.cookie.match(/csrf_token=([^;]+)/);
    if (match && match[1]) {
      _csrfToken = match[1];
      return _csrfToken;
    }
    return '';
  }

  /**
   * Fetch the CSRF token asynchronously.
   * Tries cookie, frappe global, then the custom VCL endpoint.
   * Stores the result for later calls.
   */
  async function fetchCsrfToken() {
    // 1. Cookie
    var match = document.cookie.match(/csrf_token=([^;]+)/);
    if (match && match[1]) {
      _csrfToken = match[1];
      return _csrfToken;
    }

    // 2. frappe global (available on desk pages)
    if (typeof frappe !== 'undefined' && frappe.csrf_token) {
      _csrfToken = frappe.csrf_token;
      return _csrfToken;
    }

    // 3. Custom endpoint (works on www pages without frappe boot)
    try {
      var res = await fetch(
        '/api/method/vcl_sales_dashboard.api.collections_utils.get_csrf_token',
        { method: 'GET', credentials: 'same-origin', headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        var json = await res.json();
        if (json && json.message) {
          _csrfToken = json.message;
          return _csrfToken;
        }
      }
    } catch (_ignored) {
      // silently fall through
    }

    return '';
  }

  // ----------------------------------------------------------
  // HTTP helpers
  // ----------------------------------------------------------

  /**
   * Perform a GET request. Returns the parsed JSON response.
   * Includes the CSRF token header for Frappe compatibility.
   */
  async function apiGet(url) {
    var token = getCsrfToken();
    var headers = { 'Accept': 'application/json' };
    if (token) {
      headers['X-Frappe-CSRF-Token'] = token;
    }
    var res = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: headers
    });
    if (!res.ok) {
      throw new Error('GET ' + url + ' failed: HTTP ' + res.status);
    }
    return res.json();
  }

  /**
   * Perform a POST request with CSRF token.
   * `body` can be a FormData, URLSearchParams, or plain object (sent as JSON).
   * Returns the raw Response object so callers can inspect status.
   */
  async function apiPost(url, body) {
    var token = getCsrfToken();
    if (!token) {
      throw new Error('CSRF token missing. Please refresh the page.');
    }

    var headers = { 'X-Frappe-CSRF-Token': token };
    var fetchBody;

    if (body instanceof FormData || body instanceof URLSearchParams) {
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body || {});
    }

    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: fetchBody
    });
  }

  /**
   * Shorthand for calling a Frappe whitelisted method.
   *   VCL.api('vcl_sales_dashboard.api.foo.bar', { customer: 'ABC' })
   * Returns `response.message` (the standard Frappe payload).
   */
  async function api(method, args) {
    var res = await apiPost('/api/method/' + method, args);
    if (!res.ok) {
      var text = '';
      try { text = await res.text(); } catch (_e) { /* ignore */ }
      throw new Error('API ' + method + ' failed: HTTP ' + res.status + ' ' + text);
    }
    var json = await res.json();
    return json.message !== undefined ? json.message : json;
  }

  // ----------------------------------------------------------
  // Formatting helpers
  // ----------------------------------------------------------

  /**
   * Format a numeric value with two decimal places and locale grouping.
   *   VCL.fmtCurrency(1234567.8)  =>  "1,234,567.80"
   */
  function fmtCurrency(value) {
    return parseFloat(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Escape a string for safe insertion into HTML.
   */
  function escapeHtml(s) {
    if (s == null) return '';
    var str = String(s);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      switch (ch) {
        case '&':  out += '&amp;';  break;
        case '<':  out += '&lt;';   break;
        case '>':  out += '&gt;';   break;
        case '"':  out += '&quot;'; break;
        case "'":  out += '&#39;';  break;
        default:   out += ch;
      }
    }
    return out;
  }

  // ----------------------------------------------------------
  // UI helpers
  // ----------------------------------------------------------

  /**
   * Show a message banner inside a `#msg-area` element on the page.
   * @param {string}  text     - Message text (plain text, will be escaped).
   * @param {string}  type     - One of 'success', 'error', 'warning'.
   * @param {number}  timeout  - Auto-hide after ms (0 = stay visible). Default 5000.
   */
  function showMsg(text, type, timeout) {
    var area = document.getElementById('msg-area');
    if (!area) return;

    var div = document.createElement('div');
    div.className = 'msg-info ' + (type || '');
    div.textContent = text;
    area.innerHTML = '';
    area.appendChild(div);

    var ms = timeout !== undefined ? timeout : 5000;
    if (ms > 0) {
      setTimeout(function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, ms);
    }
  }

  // ----------------------------------------------------------
  // Auth helpers
  // ----------------------------------------------------------

  /**
   * Detect whether a response indicates an authentication failure
   * (401, 403, or Frappe session-expired redirect).
   *
   * @param {Response}  response  - The fetch Response object.
   * @param {object}    rawJson   - The parsed JSON body (optional).
   * @returns {boolean}
   */
  function isAuthError(response, rawJson) {
    if (!response) return false;

    // Explicit HTTP auth errors
    if (response.status === 401 || response.status === 403) {
      return true;
    }

    // Frappe sometimes returns 200 with a session-expired indicator
    if (rawJson) {
      var exc = rawJson.exc_type || rawJson._error_message || '';
      if (typeof exc === 'string') {
        var lower = exc.toLowerCase();
        if (lower.indexOf('sessionexpired') !== -1 ||
            lower.indexOf('permissionerror') !== -1 ||
            lower.indexOf('not permitted') !== -1) {
          return true;
        }
      }
      // Frappe login redirect
      if (rawJson.home_page === '/login' || rawJson._server_messages) {
        var msgs = rawJson._server_messages || '';
        if (typeof msgs === 'string' && msgs.toLowerCase().indexOf('not permitted') !== -1) {
          return true;
        }
      }
    }

    // Redirect to login page
    var url = response.url || '';
    if (url.indexOf('/login') !== -1) {
      return true;
    }

    return false;
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  return {
    get _csrfToken()    { return _csrfToken; },
    set _csrfToken(v)   { _csrfToken = v; },

    getCsrfToken:   getCsrfToken,
    fetchCsrfToken: fetchCsrfToken,

    apiGet:   apiGet,
    apiPost:  apiPost,
    api:      api,

    fmtCurrency: fmtCurrency,
    escapeHtml:  escapeHtml,

    showMsg:     showMsg,
    isAuthError: isAuthError
  };
})();
