"""Seed the CN-.#### naming series counter so the first issued doc is CN-0041.

Idempotent: only raises the counter, never lowers it.

Uses raw SQL against `tabSeries` because that system table is not a real DocType
and has only (name, current) columns — `frappe.db.get_value` / `.set_value` /
`.get_doc` all break on it (they inject `ORDER BY creation` and other DocType
assumptions).
"""
import frappe


def execute():
    series = "CN-"
    target = 40  # next inserted -> 41

    row = frappe.db.sql(
        "SELECT `current` FROM `tabSeries` WHERE name=%s",
        (series,),
        as_dict=True,
    )
    current = int(row[0]["current"]) if row else 0

    if current >= target:
        return

    if row:
        frappe.db.sql(
            "UPDATE `tabSeries` SET `current`=%s WHERE name=%s",
            (target, series),
        )
    else:
        frappe.db.sql(
            "INSERT INTO `tabSeries` (name, `current`) VALUES (%s, %s)",
            (series, target),
        )
    frappe.db.commit()
