"""Seed the CN-.#### naming series counter so the first issued doc is CN-0041.

Idempotent: only raises the counter, never lowers it.
"""
import frappe


def execute():
    series = "CN-"
    target = 40  # next inserted -> 41
    current = frappe.db.get_value("Series", series, "current") or 0
    if int(current) < target:
        if frappe.db.exists("Series", series):
            frappe.db.set_value("Series", series, "current", target, update_modified=False)
        else:
            frappe.get_doc({
                "doctype": "Series",
                "name": series,
                "current": target,
            }).insert(ignore_permissions=True)
    frappe.db.commit()
