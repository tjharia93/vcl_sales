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


# ── Ageing bucket calculation ────────────────────────────────────────

BUCKET_ORDER = [
    "bucket_current",
    "bucket_1_15",
    "bucket_16_30",
    "bucket_31_45",
    "bucket_46_60",
    "bucket_61_75",
    "bucket_76_90",
    "bucket_91_105",
    "bucket_106_120",
    "bucket_121_135",
    "bucket_136_150",
    "bucket_151_165",
    "bucket_166_180",
    "bucket_181_over",
]

TERM_BUCKET_RULES = {
    0: {
        "due_current": "bucket_current",
        "due_next": None,
        "overdue_from": "bucket_1_15",
        "overdue_30_from": "bucket_31_45",
    },
    15: {
        "due_current": "bucket_1_15",
        "due_next": "bucket_current",
        "overdue_from": "bucket_16_30",
        "overdue_30_from": "bucket_46_60",
    },
    30: {
        "due_current": "bucket_16_30",
        "due_next": "bucket_1_15",
        "overdue_from": "bucket_31_45",
        "overdue_30_from": "bucket_61_75",
    },
    45: {
        "due_current": "bucket_31_45",
        "due_next": "bucket_16_30",
        "overdue_from": "bucket_46_60",
        "overdue_30_from": "bucket_76_90",
    },
    60: {
        "due_current": "bucket_46_60",
        "due_next": "bucket_31_45",
        "overdue_from": "bucket_61_75",
        "overdue_30_from": "bucket_91_105",
    },
    75: {
        "due_current": "bucket_61_75",
        "due_next": "bucket_46_60",
        "overdue_from": "bucket_76_90",
        "overdue_30_from": "bucket_106_120",
    },
    90: {
        "due_current": "bucket_76_90",
        "due_next": "bucket_61_75",
        "overdue_from": "bucket_91_105",
        "overdue_30_from": "bucket_121_135",
    },
}


def parse_credit_days(term_value):
    """Parse a terms string or number into an integer day count.
    Returns one of 15, 30, 45, 60, 75, 90 or None."""
    if term_value is None:
        return None

    # Handle numeric values directly (Excel may pass int/float)
    if isinstance(term_value, (int, float)):
        days = int(term_value)
    else:
        s = str(term_value).strip().lower()
        if not s:
            return None
        # "Current" or "COD" means 0-day terms
        if s in ("current", "cod", "cash", "immediate", "c.o.d", "c.o.d."):
            return 0
        # Extract first number from the string
        match = re.search(r"(\d+)", s)
        if not match:
            return 0  # No number found — treat as 0-day terms
        days = int(match.group(1))

    if days <= 0:
        return 0

    # Snap to nearest supported bucket threshold
    supported = sorted(TERM_BUCKET_RULES.keys())
    for t in supported:
        if days <= t:
            return t
    return supported[-1]  # cap at 90


def calculate_ageing_summary_from_buckets(bucket_values, credit_days):
    """Calculate due/overdue from raw bucket values and credit days.

    Args:
        bucket_values: dict of bucket fieldname -> float amount
        credit_days: int (0, 15, 30, 45, 60, 75, 90) or None

    Returns dict with due_current_month, due_next_month, overdue_amount, overdue_30_amount
    """
    if credit_days is None or credit_days not in TERM_BUCKET_RULES:
        return {
            "due_current_month": 0,
            "due_next_month": 0,
            "overdue_amount": 0,
            "overdue_30_amount": 0,
        }

    rules = TERM_BUCKET_RULES[credit_days]

    def bucket_sum_from(start_bucket):
        start_index = BUCKET_ORDER.index(start_bucket)
        return sum(flt(bucket_values.get(b, 0)) for b in BUCKET_ORDER[start_index:])

    return {
        "due_current_month": flt(bucket_values.get(rules["due_current"], 0)),
        "due_next_month": flt(bucket_values.get(rules["due_next"], 0)) if rules["due_next"] else 0,
        "overdue_amount": bucket_sum_from(rules["overdue_from"]),
        "overdue_30_amount": bucket_sum_from(rules["overdue_30_from"]),
    }


def resolve_terms(customer, terms_from_file):
    """Resolve terms from file and ERPNext Customer, determine which to use.

    Returns dict with:
        terms_from_file, credit_terms_from_customer,
        terms_used_for_calculation, credit_days, terms_match_status
    """
    result = {
        "terms_from_file": terms_from_file or None,
        "credit_terms_from_customer": None,
        "terms_used_for_calculation": None,
        "credit_days": None,
        "terms_match_status": "Missing Both",
    }

    # Get ERPNext customer terms if customer matched
    erp_terms = None
    if customer:
        # Try multiple ERPNext fields where terms might be stored
        try:
            cust = frappe.db.get_value(
                "Customer", customer,
                ["payment_terms"],
                as_dict=True
            ) or {}
        except Exception:
            cust = {}

        if cust.get("payment_terms"):
            # Payment Terms Template name — try to extract days from the template
            pt_name = cust["payment_terms"]
            try:
                credit_days_from_template = frappe.db.get_value(
                    "Payment Terms Template Detail",
                    {"parent": pt_name},
                    "credit_days"
                )
                if credit_days_from_template:
                    erp_terms = str(int(credit_days_from_template)) + " Days"
                else:
                    erp_terms = pt_name  # Use template name as-is
            except Exception:
                erp_terms = pt_name

        result["credit_terms_from_customer"] = erp_terms

    file_days = parse_credit_days(terms_from_file) if terms_from_file else None
    erp_days = parse_credit_days(erp_terms) if erp_terms else None

    # Determine terms_match_status
    if terms_from_file and erp_terms:
        if file_days == erp_days:
            result["terms_match_status"] = "Matched"
        else:
            result["terms_match_status"] = "Mismatch"
    elif terms_from_file and not erp_terms:
        result["terms_match_status"] = "File Only"
    elif not terms_from_file and erp_terms:
        result["terms_match_status"] = "ERPNext Only"
    else:
        result["terms_match_status"] = "Missing Both"

    # Priority: file terms first, then ERPNext, then default 0
    if file_days is not None:
        result["terms_used_for_calculation"] = terms_from_file
        result["credit_days"] = file_days
    elif erp_days is not None:
        result["terms_used_for_calculation"] = erp_terms
        result["credit_days"] = erp_days
    else:
        # Default: assume 0-day terms (everything except Current is overdue)
        result["terms_used_for_calculation"] = "Current (default)"
        result["credit_days"] = 0

    return result


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
