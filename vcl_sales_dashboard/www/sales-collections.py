import frappe

no_cache = 1


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/sales-collections"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    allowed_roles = ["Sales User", "Sales Manager", "Finance Manager", "System Manager"]
    if not any(r in roles for r in allowed_roles):
        frappe.throw("Not permitted", frappe.PermissionError)

    context.user_name = frappe.utils.get_fullname(frappe.session.user)
    context.user_role = next(
        (r for r in ["System Manager", "Finance Manager", "Sales Manager", "Sales User"] if r in roles),
        "Sales User"
    )
    context.is_manager = context.user_role in ["Sales Manager", "Finance Manager", "System Manager"]
    context.csrf_token = frappe.sessions.get_csrf_token()
