/**
 * VCL Collections Module - Shared JavaScript utilities
 * Used by collections dashboard and import pages.
 */

const VCLCollections = {
  /**
   * Call a Frappe whitelisted API method.
   */
  call(method, args) {
    return fetch('/api/method/' + method, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': frappe.csrf_token
      },
      body: JSON.stringify(args || {})
    })
    .then(r => r.json())
    .then(r => r.message || r);
  },

  /**
   * Format a number as currency string.
   */
  formatCurrency(value) {
    return parseFloat(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /**
   * Convert a follow-up status string to a CSS class name.
   */
  statusClass(status) {
    return 'st-' + (status || 'not-contacted').toLowerCase().replace(/\s+/g, '-');
  },

  /**
   * Follow-up status options.
   */
  followUpStatuses: [
    'Not Contacted',
    'Contacted',
    'Promise to Pay',
    'Part Payment Expected',
    'In Dispute',
    'Waiting for Statement',
    'Waiting for Credit Note',
    'Escalated',
    'Cleared'
  ],

  /**
   * Comment type options.
   */
  commentTypes: [
    'Call',
    'Visit',
    'Email',
    'WhatsApp',
    'Internal Note',
    'Escalation'
  ]
};
