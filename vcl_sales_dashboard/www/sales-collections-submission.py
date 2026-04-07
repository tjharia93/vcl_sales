import frappe

no_cache = 1


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/sales-collections-submission"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    allowed_roles = ["Finance Manager", "System Manager"]
    if not any(r in roles for r in allowed_roles):
        frappe.throw("Not permitted. Only Finance Manager or System Manager can submit collections.", frappe.PermissionError)

    context.no_cache = 1
    context.user_name = frappe.utils.get_fullname(frappe.session.user)
    context.user_role = next(
        (r for r in ["System Manager", "Finance Manager"] if r in roles),
        "Finance Manager"
    )
    return context
