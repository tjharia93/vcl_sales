import frappe

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect

    roles = frappe.get_roles(frappe.session.user)
    allowed_roles = ["Sales User", "Sales Manager", "Finance Manager", "System Manager"]
    if not any(r in roles for r in allowed_roles):
        frappe.throw("Not permitted", frappe.PermissionError)

    customer = frappe.form_dict.get("name")
    if not customer:
        frappe.local.flags.redirect_location = "/sales-dashboard"
        raise frappe.Redirect

    if not frappe.db.exists("Customer", customer):
        frappe.throw("Customer not found", frappe.DoesNotExistError)

    # Role-based access: Sales Reps can only view customers they own
    user = frappe.session.user
    if not any(r in roles for r in ["Sales Manager", "Finance Manager", "System Manager"]):
        owner = frappe.db.get_value("Customer", customer, "owner")
        if owner != user:
            frappe.throw("Not permitted", frappe.PermissionError)

    context.customer = customer
    context.customer_name = frappe.db.get_value("Customer", customer, "customer_name") or customer
    context.user_name = frappe.utils.get_fullname(user)
    context.user_role = next(
        (r for r in ["Sales Manager", "Finance Manager", "System Manager", "Sales User"] if r in roles),
        "Sales User"
    )
