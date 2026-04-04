import frappe

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    allowed_roles = ["Sales Manager", "Finance Manager", "System Manager"]
    if not any(r in roles for r in allowed_roles):
        frappe.throw("Not permitted", frappe.PermissionError)

    context.user_name = frappe.utils.get_fullname(frappe.session.user)
