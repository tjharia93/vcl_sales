"""
Frappe page controller for the VCL Quotation SPA.

The HTML and asset bundle in this folder are emitted by the Vite build at
`vcl_sales_dashboard/vcl_quotation/frontend/`. This controller only enforces
auth before the static SPA is served.
"""

import frappe

no_cache = 1


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/quotation"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    allowed_roles = {
        "Sales User",
        "Sales Manager",
        "Finance Manager",
        "System Manager",
    }
    if not (set(roles) & allowed_roles):
        frappe.throw("Not permitted", frappe.PermissionError)

    return context
