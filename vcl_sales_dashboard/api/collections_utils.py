import frappe
import re
from frappe.utils import flt


# ── CSRF token helper ───────────────────────────────────────────────

@frappe.whitelist(allow_guest=True)
def get_csrf_token():
    """Return the CSRF token for the current session.
    This is a custom endpoint because frappe.auth.get_csrf_token
    does not exist in all Frappe versions."""
    return frappe.sessions.get_csrf_token()


# ── Header normalization ─────────────────────────────────────────────

# Maps normalized key → doctype field name
COLUMN_MAP = {
    "customer_name":            "excel_customer_name",
    "sales_representative":     "excel_sales_representative",
    "terms":                    "terms",
    "current":                  "bucket_current",
    "1_to_15":                  "bucket_1_15",
    "16_to_30":                 "bucket_16_30",
    "31_to_45":                 "bucket_31_45",
    "46_to_60":                 "bucket_46_60",
    "61_to_75":                 "bucket_61_75",
    "76_to_90":                 "bucket_76_90",
    "91_to_105":                "bucket_91_105",
    "106_to_120":               "bucket_106_120",
    "121_to_135":               "bucket_121_135",
    "136_to_150":               "bucket_136_150",
    "151_to_165":               "bucket_151_165",
    "166_to_180":               "bucket_166_180",
    "165_to_180":               "bucket_166_180",  # alias
    "181_and_over":             "bucket_181_over",
    "total":                    "total_balance",
    "over_due":                 "overdue_amount",
    "overdue":                  "overdue_amount",
    "overdue_30_days":          "overdue_30_amount",
    "over_due_30_days":         "overdue_30_amount",
    "due_current_month":        "due_current_month",
    "due_next_month":           "due_next_month",
    "pd_cheques_cm":            "pd_cheques_cm",
    "check":                    "check_value",
}

# Required columns that must be present
REQUIRED_COLUMNS = [
    "excel_customer_name",
    "total_balance",
]

# Currency fields on the snapshot
CURRENCY_FIELDS = [
    "bucket_current", "bucket_1_15", "bucket_16_30", "bucket_31_45",
    "bucket_46_60", "bucket_61_75", "bucket_76_90", "bucket_91_105",
    "bucket_106_120", "bucket_121_135", "bucket_136_150", "bucket_151_165",
    "bucket_166_180", "bucket_181_over", "total_balance", "overdue_amount",
    "overdue_30_amount", "due_current_month", "due_next_month",
    "pd_cheques_cm", "check_value",
]


def normalise_header(raw):
    """Normalise a raw Excel header string to a canonical key."""
    s = str(raw).strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = s.strip("_")
    return s


def map_headers(raw_headers):
    """Return {original_header: doctype_field} for all recognised columns."""
    mapped = {}
    for raw in raw_headers:
        key = normalise_header(raw)
        if key in COLUMN_MAP:
            mapped[raw] = COLUMN_MAP[key]
    return mapped


def validate_required_columns(header_map):
    """Check that all required doctype fields are present in the mapping. Returns list of missing."""
    mapped_fields = set(header_map.values())
    return [f for f in REQUIRED_COLUMNS if f not in mapped_fields]


# ── Customer matching ────────────────────────────────────────────────

def match_customer(excel_customer_name):
    """Match Excel customer name to ERPNext Customer.
    Returns (customer_name, match_status) tuple."""
    if not excel_customer_name:
        return None, "Customer Not Matched"

    name = excel_customer_name.strip()

    # 1. Exact match
    if frappe.db.exists("Customer", name):
        return name, "Matched"

    # 2. Case-insensitive / trimmed match
    result = frappe.db.sql("""
        SELECT name FROM `tabCustomer`
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(%(name)s))
           OR LOWER(TRIM(customer_name)) = LOWER(TRIM(%(name)s))
        LIMIT 1
    """, {"name": name}, as_dict=True)

    if result:
        return result[0].name, "Matched"

    return None, "Customer Not Matched"


# ── Sales rep user resolution ────────────────────────────────────────

def resolve_sales_rep_user(rep_value):
    """Resolve a rep label/name to a real ERPNext User.name.

    Resolution order:
    1. Exact User.name match (email-style)
    2. Exact User.full_name match
    3. Case-insensitive User.name match
    4. Case-insensitive User.full_name match
    5. Sales Rep User Mapping lookup
    6. Return None (don't fail)
    """
    if not rep_value:
        return None

    rep_value = str(rep_value).strip()
    if not rep_value:
        return None

    # 1. Exact User.name
    if frappe.db.exists("User", rep_value):
        return rep_value

    # 2. Exact full_name
    user = frappe.db.get_value("User", {"full_name": rep_value, "enabled": 1}, "name")
    if user:
        return user

    # 3. Case-insensitive User.name
    result = frappe.db.sql("""
        SELECT name FROM `tabUser`
        WHERE enabled = 1 AND LOWER(name) = LOWER(%(val)s)
        LIMIT 1
    """, {"val": rep_value}, as_dict=True)
    if result:
        return result[0].name

    # 4. Case-insensitive full_name
    result = frappe.db.sql("""
        SELECT name FROM `tabUser`
        WHERE enabled = 1 AND LOWER(full_name) = LOWER(%(val)s)
        LIMIT 1
    """, {"val": rep_value}, as_dict=True)
    if result:
        return result[0].name

    # 5. Sales Rep User Mapping
    mapping_user = frappe.db.get_value(
        "Sales Rep User Mapping",
        {"sales_rep_label": rep_value},
        "user"
    )
    if mapping_user and frappe.db.exists("User", mapping_user):
        return mapping_user

    return None


# ── Sales rep assignment resolution ──────────────────────────────────

def resolve_sales_rep_assignment(customer, period_end):
    """Resolve the sales rep assignment for a customer as of the period end date.

    Returns dict with:
        assigned_sales_representative,
        sales_rep_user,
        customer_sales_rep_assignment,
        assignment_match_status
    """
    result = {
        "assigned_sales_representative": None,
        "sales_rep_user": None,
        "customer_sales_rep_assignment": None,
        "assignment_match_status": "No Valid Assignment For Period",
    }

    if not customer:
        result["assignment_match_status"] = "Imported With Warning"
        return result

    assignments = frappe.db.sql("""
        SELECT name, sales_representative, priority
        FROM `tabCustomer Sales Rep Assignment`
        WHERE customer = %(customer)s
          AND status = 'Active'
          AND effective_from <= %(period_end)s
          AND (effective_to IS NULL OR effective_to = '' OR effective_to >= %(period_end)s)
        ORDER BY priority ASC, modified DESC
    """, {
        "customer": customer,
        "period_end": period_end,
    }, as_dict=True)

    if not assignments:
        result["assignment_match_status"] = "No Valid Assignment For Period"
        return result

    # Use first valid assignment by priority
    a = assignments[0]
    rep_label = (a.sales_representative or "").strip()

    result["assigned_sales_representative"] = rep_label or None
    result["customer_sales_rep_assignment"] = a.name
    result["sales_rep_user"] = resolve_sales_rep_user(rep_label) if rep_label else None

    if len(assignments) > 1:
        # Multiple active assignments — still use first, but flag it
        result["assignment_match_status"] = "Multiple Assignments Found"
    else:
        # Only call it fully matched if user resolution also succeeded
        result["assignment_match_status"] = "Matched" if result["sales_rep_user"] else "Imported With Warning"

    return result


# ── File helpers ─────────────────────────────────────────────────────

def get_file_path(file_url):
    """Convert an ERPNext file URL to an absolute file path."""
    if not file_url:
        frappe.throw("No file URL provided.")

    site_path = frappe.get_site_path()
    if file_url.startswith("/private/files/"):
        return f"{site_path}{file_url}"
    elif file_url.startswith("/files/"):
        return f"{site_path}/public{file_url}"
    else:
        return f"{site_path}/public{file_url}"


def safe_flt(val):
    """Convert a value to float, treating blanks/errors as 0."""
    if val is None:
        return 0.0
    try:
        return flt(val)
    except (ValueError, TypeError):
        return 0.0


# ── Sales rep label → User mapping ───────────────────────────────────

def get_rep_label_map():
    """Return {label: user} dict from Sales Rep User Mapping."""
    rows = frappe.get_all(
        "Sales Rep User Mapping",
        fields=["sales_rep_label", "user"],
        ignore_permissions=True,
    )
    return {r.sales_rep_label: r.user for r in rows}


def resolve_rep_user_from_label(label, label_map=None):
    """Resolve an Excel rep label to an ERPNext User via Sales Rep User Mapping.
    Returns the user email or None."""
    if not label:
        return None
    label = label.strip()
    if label_map is None:
        label_map = get_rep_label_map()
    return label_map.get(label)


# ── Role helpers ─────────────────────────────────────────────────────

def get_collections_role_filter():
    """Returns user email for Sales User filtering, or None for managers."""
    user = frappe.session.user
    roles = frappe.get_roles(user)
    if any(r in roles for r in ["Sales Manager", "Finance Manager", "System Manager"]):
        return None
    return user
