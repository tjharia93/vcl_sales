"""
Whitelisted API methods for the VCL Quotation system.

Replaces the Phase 1 Express endpoints documented in
`docs/quotation-system/API_MIGRATION.md`. All methods follow the
{ status, data | message } envelope used elsewhere in vcl_sales_dashboard.
"""

import json
import re

import frappe
from frappe import _


# ---------------------------------------------------------------------------
# Field mapping helpers
# ---------------------------------------------------------------------------

# Explicit mappings from React form keys to DocType fields. Anything not in
# this map falls through to the case-tolerant resolver in `_resolve_field`,
# which also accepts native snake_case + generic camelCase. The map is kept
# for clarity and to handle edge cases where a generic conversion would
# round-trip badly (e.g. `hasUV` would become `has_u_v`, not `has_uv`).
FORM_FIELD_MAP = {
    "quoteRef":         "quote_ref",
    "productType":      "product_type",
    "preparedBy":       "prepared_by",
    "customer":         "customer",
    "productDesc":      "product_desc",
    "validUntil":       "valid_until",
    "paymentTerms":     "payment_terms",
    "remarks":          "remarks",
    "styleCode":        "style_code",
    "ply":              "ply",
    "fluteCode":        "flute_code",
    "dimL":             "dim_l",
    "dimW":             "dim_w",
    "dimH":             "dim_h",
    "qty":              "qty",
    "inkColours":       "ink_colours",
    "hasLam":           "has_lam",
    "hasDieCut":        "has_die_cut",
    "hasUV":            "has_uv",
    "labourType":       "labour_type",
    "sellingPrice":     "selling_price",
    "sfkWidth":         "sfk_width",
    "sfkMetres":        "sfk_metres",
    "sfkQty":           "sfk_qty",
    "sfkLiner":         "sfk_liner",
    "sfkMedium":        "sfk_medium",
    "sfkFlute":         "sfk_flute",
    "sfkApplication":   "sfk_application",
    "sfkCore":          "sfk_core",
    "sfkSellingPrice":  "sfk_selling_price",
    "marginPct":        "margin_pct",
    "priceStatus":      "price_status",
    "fullCostEach":     "full_cost_each",
    "status":           "status",
    "customerText":     "customer_text",
    # Per-layer GSM / type fields — the React form emits the snake-prefixed
    # camelCase shape (`gsm_topLiner`); a few helper scripts use camelCase
    # (`gsmTopLiner`). Both are accepted explicitly so we don't depend on
    # the generic camelCase fallback for these high-traffic fields.
    "gsm_topLiner":     "gsm_top_liner",
    "type_topLiner":    "type_top_liner",
    "gsm_medium1":      "gsm_medium1",
    "gsm_midLiner":     "gsm_mid_liner",
    "gsm_medium2":      "gsm_medium2",
    "gsm_botLiner":     "gsm_bot_liner",
    "type_botLiner":    "type_bot_liner",
    "gsmTopLiner":      "gsm_top_liner",
    "typeTopLiner":     "type_top_liner",
    "gsmMidLiner":      "gsm_mid_liner",
    "gsmBotLiner":      "gsm_bot_liner",
    "typeBotLiner":     "type_bot_liner",
    "gsmMedium1":       "gsm_medium1",
    "gsmMedium2":       "gsm_medium2",
}

DOC_TO_FORM_MAP = {}
for k, v in FORM_FIELD_MAP.items():
    # Prefer the snake-prefixed form (gsm_topLiner) when round-tripping to
    # the React form so the existing layer-render code keeps working.
    if v not in DOC_TO_FORM_MAP or "_" in k:
        DOC_TO_FORM_MAP[v] = k

CHECKBOX_FIELDS = {"has_lam", "has_die_cut", "has_uv"}
INT_FIELDS = {"qty", "ink_colours", "sfk_qty", "gsm_top_liner", "gsm_medium1",
              "gsm_mid_liner", "gsm_medium2", "gsm_bot_liner"}
FLOAT_FIELDS = {"dim_l", "dim_w", "dim_h", "sfk_width", "sfk_metres",
                "selling_price", "sfk_selling_price", "margin_pct",
                "full_cost_each"}

DASHBOARD_FIELDS = [
    "name", "quote_ref", "customer", "customer_text", "product_desc",
    "product_type", "qty", "selling_price", "sfk_qty", "sfk_selling_price",
    "sfk_width", "prepared_by", "status", "docstatus", "creation",
    "modified", "margin_pct", "price_status", "style_code", "dim_l",
    "dim_w", "dim_h", "ply", "flute_code", "amended_from",
]

VALID_STATUSES = ("Pending", "Won", "Lost")
_CAMEL_RE = re.compile(r"([a-z0-9])([A-Z])")


def _ok(data=None):
    out = {"status": "ok"}
    if data is not None:
        out["data"] = data
    return out


def _err(message, log_title="VCL Quotation API Error"):
    frappe.log_error(frappe.get_traceback(), log_title)
    return {"status": "error", "message": str(message)}


def _parse(value):
    if isinstance(value, (dict, list)):
        return value
    if value in (None, ""):
        return None
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


def _coerce(field, value):
    if value in (None, ""):
        return None
    if field in CHECKBOX_FIELDS:
        return 1 if str(value).lower() in ("1", "true", "yes", "on") else 0
    if field in INT_FIELDS:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None
    if field in FLOAT_FIELDS:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return value


def _valid_columns():
    """DocType field names — cached on the Frappe meta layer."""
    return set(frappe.get_meta("VCL Quotation").get_valid_columns())


def _resolve_field(form_key):
    """Map an inbound form key to a DocType field name, or None to drop it.

    Order:
      1. Explicit FORM_FIELD_MAP (covers camelCase + snake-prefixed shapes)
      2. Already a valid snake_case column name (QUOT-005)
      3. Generic camelCase → snake_case conversion (catches anything new)
    """
    if form_key in FORM_FIELD_MAP:
        return FORM_FIELD_MAP[form_key]
    columns = _valid_columns()
    if form_key in columns:
        return form_key
    converted = _CAMEL_RE.sub(r"\1_\2", form_key).lower()
    if converted in columns:
        return converted
    return None


def _form_to_doc(form):
    """Convert a React form payload (any case convention) into DocType fields."""
    doc_data = {}
    for form_key, value in form.items():
        if form_key in ("id", "savedAt", "showModal", "costRows"):
            continue
        target = _resolve_field(form_key)
        if target is None:
            continue
        doc_data[target] = _coerce(target, value)
    return doc_data


def _doc_to_form(doc):
    """Convert a saved VCL Quotation document back into the React form shape."""
    form = {
        "id": doc.name,
        "savedAt": doc.modified.isoformat() if doc.modified else None,
        "docstatus": doc.docstatus,
        "amendedFrom": doc.get("amended_from"),
    }
    for doc_field, form_key in DOC_TO_FORM_MAP.items():
        value = doc.get(doc_field)
        if doc_field in CHECKBOX_FIELDS:
            value = bool(value)
        form[form_key] = value

    rows = []
    for row in (doc.get("cost_rows") or []):
        rows.append({
            "label":      row.label,
            "each":       row.cost_each,
            "tot":        row.cost_total,
            "pct":        row.pct_of_total,
        })
    form["costRows"] = rows
    return form


# ---------------------------------------------------------------------------
# Quote list / read / save / status
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_quote_list():
    try:
        rows = frappe.get_list(
            "VCL Quotation",
            fields=DASHBOARD_FIELDS,
            order_by="modified desc",
            limit=200,
        )
        out = []
        for r in rows:
            is_sfk = (r.get("product_type") == "sfk")
            out.append({
                "id":            r.get("name"),
                "quoteRef":      r.get("quote_ref") or r.get("name"),
                "customer":      r.get("customer"),
                "customerText":  r.get("customer_text"),
                "productDesc":   r.get("product_desc"),
                "productType":   r.get("product_type"),
                "qty":           r.get("sfk_qty") if is_sfk else r.get("qty"),
                "sellingPrice":  r.get("sfk_selling_price") if is_sfk else r.get("selling_price"),
                "preparedBy":    r.get("prepared_by"),
                "status":        r.get("status") or "Pending",
                "docstatus":     r.get("docstatus") or 0,
                "savedAt":       r.get("modified").isoformat() if r.get("modified") else None,
                "marginPct":     r.get("margin_pct"),
                "priceStatus":   r.get("price_status"),
                "styleCode":     r.get("style_code"),
                "dimL":          r.get("dim_l"),
                "dimW":          r.get("dim_w"),
                "dimH":          r.get("dim_h"),
                "ply":           r.get("ply"),
                "fluteCode":     r.get("flute_code"),
                "sfkWidth":      r.get("sfk_width"),
                "amendedFrom":   r.get("amended_from"),
            })
        return _ok(out)
    except Exception as e:
        return _err(e, "VCL Quotation List Error")


@frappe.whitelist()
def get_quote(name):
    try:
        if not name:
            frappe.throw(_("Quote name is required"))
        if not frappe.db.exists("VCL Quotation", name):
            return {"status": "error", "message": _("Quote not found")}
        doc = frappe.get_doc("VCL Quotation", name)
        return _ok(_doc_to_form(doc))
    except Exception as e:
        return _err(e, "VCL Quotation Read Error")


def _apply_customer_split(doc_data, form):
    """Customer field design (Tanuj 2026-05-09): always preserve what the rep
    typed; only set the link field when it matches a Customer master record."""
    typed = form.get("customer") or form.get("customerText")
    if not typed:
        return
    doc_data["customer_text"] = typed
    if frappe.db.exists("Customer", typed):
        doc_data["customer"] = typed
    else:
        doc_data["customer"] = None


@frappe.whitelist()
def save_quote(form=None, cost_rows=None):
    """Upsert a VCL Quotation from the React form payload.

    `form`  — form state from the SPA, accepts camelCase or snake_case keys
    `cost_rows` — list of {label, each, tot, pct} cost breakdown rows
    """
    try:
        form = _parse(form) or {}
        rows = _parse(cost_rows) or form.get("costRows") or []
        if not isinstance(form, dict):
            frappe.throw(_("Invalid form payload"))

        doc_data = _form_to_doc(form)
        _apply_customer_split(doc_data, form)
        existing_name = form.get("id") or form.get("quoteRef")

        if existing_name and frappe.db.exists("VCL Quotation", existing_name):
            doc = frappe.get_doc("VCL Quotation", existing_name)
            if doc.docstatus != 0:
                frappe.throw(_("Quote {0} is {1} and cannot be edited.").format(
                    doc.name,
                    "submitted" if doc.docstatus == 1 else "cancelled",
                ))
            doc.update(doc_data)
            doc.set("cost_rows", [])
            for row in rows:
                doc.append("cost_rows", {
                    "label":        row.get("label"),
                    "cost_each":    row.get("each") or row.get("cost_each"),
                    "cost_total":   row.get("tot") or row.get("cost_total"),
                    "pct_of_total": row.get("pct") or row.get("pct_of_total"),
                })
            doc.save()
            created = False
        else:
            doc = frappe.new_doc("VCL Quotation")
            doc.update(doc_data)
            for row in rows:
                doc.append("cost_rows", {
                    "label":        row.get("label"),
                    "cost_each":    row.get("each") or row.get("cost_each"),
                    "cost_total":   row.get("tot") or row.get("cost_total"),
                    "pct_of_total": row.get("pct") or row.get("pct_of_total"),
                })
            doc.insert()
            created = True

        return _ok({
            "id":         doc.name,
            "quoteRef":   doc.quote_ref or doc.name,
            "docstatus":  doc.docstatus,
            "created":    created,
            "updated":    not created,
        })
    except frappe.PermissionError:
        raise
    except Exception as e:
        return _err(e, "VCL Quotation Save Error")


@frappe.whitelist()
def update_quote_status(name, status):
    try:
        if status not in VALID_STATUSES:
            frappe.throw(_("Invalid status: {0}").format(status))
        if not frappe.db.exists("VCL Quotation", name):
            return {"status": "error", "message": _("Quote not found")}
        doc = frappe.get_doc("VCL Quotation", name)
        doc.status = status
        # Status changes are allowed on Draft and Submitted quotes — they
        # don't alter the cost rollup, just the sales-pipeline label. Skip
        # validate so a submitted doc can still be moved Pending → Won/Lost
        # without being amended first.
        doc.flags.ignore_validate_update_after_submit = True
        doc.save()
        return _ok({"id": doc.name, "status": doc.status})
    except Exception as e:
        return _err(e, "VCL Quotation Status Error")


# ---------------------------------------------------------------------------
# Lifecycle: submit / cancel / amend
# ---------------------------------------------------------------------------

@frappe.whitelist()
def submit_quote(name):
    """Move a Draft quote to Submitted (docstatus 1)."""
    try:
        if not frappe.db.exists("VCL Quotation", name):
            return {"status": "error", "message": _("Quote not found")}
        doc = frappe.get_doc("VCL Quotation", name)
        if doc.docstatus != 0:
            frappe.throw(_("Only Draft quotes can be submitted"))
        doc.submit()
        return _ok({"id": doc.name, "docstatus": doc.docstatus})
    except frappe.PermissionError:
        raise
    except Exception as e:
        return _err(e, "VCL Quotation Submit Error")


@frappe.whitelist()
def cancel_quote(name):
    """Cancel a Submitted quote (docstatus 1 → 2)."""
    try:
        if not frappe.db.exists("VCL Quotation", name):
            return {"status": "error", "message": _("Quote not found")}
        doc = frappe.get_doc("VCL Quotation", name)
        if doc.docstatus != 1:
            frappe.throw(_("Only Submitted quotes can be cancelled"))
        doc.cancel()
        return _ok({"id": doc.name, "docstatus": doc.docstatus})
    except frappe.PermissionError:
        raise
    except Exception as e:
        return _err(e, "VCL Quotation Cancel Error")


@frappe.whitelist()
def amend_quote(name):
    """Amend a Cancelled quote: create a new Draft with `amended_from = name`.

    Frappe's amendment naming appends `-1`, `-2`, ... to the original ref so
    `VCL-CQ-2026-0042` becomes `VCL-CQ-2026-0042-1` on first amend.
    """
    try:
        if not frappe.db.exists("VCL Quotation", name):
            return {"status": "error", "message": _("Quote not found")}
        original = frappe.get_doc("VCL Quotation", name)
        if original.docstatus != 2:
            frappe.throw(_("Only Cancelled quotes can be amended"))
        amended = frappe.copy_doc(original, ignore_no_copy=False)
        amended.amended_from = original.name
        amended.docstatus = 0
        amended.status = "Pending"
        amended.insert()
        return _ok({
            "id":          amended.name,
            "quoteRef":    amended.quote_ref or amended.name,
            "amendedFrom": original.name,
            "docstatus":   amended.docstatus,
        })
    except frappe.PermissionError:
        raise
    except Exception as e:
        return _err(e, "VCL Quotation Amend Error")


# ---------------------------------------------------------------------------
# Costing Settings (Single)
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_costing_settings():
    try:
        settings = frappe.get_single("VCL Costing Settings")
        data = settings.as_dict()
        # Strip framework-internal fields the React app does not need.
        for k in ("doctype", "name", "owner", "creation", "modified",
                  "modified_by", "docstatus", "idx", "parent",
                  "parentfield", "parenttype"):
            data.pop(k, None)

        # Hide PIN value from non-privileged sessions; React only needs to
        # know whether one is configured.
        if not _user_can_write_settings():
            data["costing_pin"] = ""
        return _ok(data)
    except Exception as e:
        return _err(e, "VCL Costing Settings Read Error")


@frappe.whitelist()
def update_costing_settings(rates):
    try:
        if not _user_can_write_settings():
            frappe.throw(_("Not permitted to update costing settings"),
                         frappe.PermissionError)
        rates = _parse(rates) or {}
        if not isinstance(rates, dict):
            frappe.throw(_("Invalid rates payload"))

        settings = frappe.get_single("VCL Costing Settings")
        meta = frappe.get_meta("VCL Costing Settings")
        allowed = {f.fieldname for f in meta.fields if f.fieldtype not in ("Section Break", "Column Break", "Tab Break")}
        for key, value in rates.items():
            if key in allowed:
                settings.set(key, value)
        settings.save()
        return _ok({"updated": True})
    except Exception as e:
        return _err(e, "VCL Costing Settings Update Error")


def _user_can_write_settings():
    roles = set(frappe.get_roles(frappe.session.user))
    return bool(roles & {"System Manager", "Finance Manager"})


# ---------------------------------------------------------------------------
# Compatibility shim — Phase 1 Express counter
# ---------------------------------------------------------------------------

@frappe.whitelist()
def next_ref():
    """Return the next quote ref without persisting a document.

    Used by the React form to display a placeholder ref before the quote is
    saved. The real name is assigned by Frappe's naming series at insert.
    """
    try:
        from frappe.model.naming import make_autoname
        ref = make_autoname("VCL-CQ-.YYYY.-.####")
        return _ok({"ref": ref})
    except Exception as e:
        return _err(e, "VCL Quotation Next Ref Error")
