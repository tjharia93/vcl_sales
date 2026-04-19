import csv
import os
from collections import defaultdict
from datetime import date

import frappe
from frappe.utils import flt, getdate


# ── Aggregation ──────────────────────────────────────────────────────

def aggregate_targets(year=None):
    """Aggregate all `Sales Target` rows into the same dict shape that
    the previous JSON file produced. Consumers in sales_dashboard.py rely
    on this exact structure.

    Args:
        year: optional int — when provided, restricts aggregation to that
              calendar year. Defaults to the current year.

    Returns:
        {
          "year": int,
          "annual_target": float,
          "monthly_targets": {"YYYY-MM": float},
          "by_product_monthly": {"YYYY-MM": {product_level_1: float}},
          "by_customer_monthly": {"YYYY-MM": {customer_name_text: float}},
        }
    """
    if year is None:
        year = date.today().year
    year = int(year)

    rows = frappe.db.sql(
        """
        SELECT period_key, period_month, customer_name_text,
               product_level_1, target_amount
        FROM `tabSales Target`
        WHERE YEAR(period_month) = %(year)s
        """,
        {"year": year},
        as_dict=True,
    )

    annual_total = 0.0
    monthly_targets = defaultdict(float)
    by_product_monthly = defaultdict(lambda: defaultdict(float))
    by_customer_monthly = defaultdict(lambda: defaultdict(float))

    for r in rows:
        amt = flt(r.target_amount)
        key = r.period_key or _derive_key(r.period_month)
        if not key:
            continue
        annual_total += amt
        monthly_targets[key] += amt
        product = (r.product_level_1 or "").strip() or "(blank)"
        by_product_monthly[key][product] += amt
        cust = (r.customer_name_text or "").strip()
        if cust:
            by_customer_monthly[key][cust] += amt

    return {
        "year": year,
        "annual_target": annual_total,
        "monthly_targets": dict(monthly_targets),
        "by_product_monthly": {k: dict(v) for k, v in by_product_monthly.items()},
        "by_customer_monthly": {k: dict(v) for k, v in by_customer_monthly.items()},
    }


def _derive_key(period_month):
    if not period_month:
        return ""
    d = getdate(period_month)
    return f"{d.year}-{d.month:02d}"


# ── CSV importer ─────────────────────────────────────────────────────

# Source CSV column names (preserved verbatim — the amount column has
# leading/trailing whitespace in the file header).
_AMOUNT_COL = "      Sum of Net Amount      "

# Map source EOMONTH (DD-MM-YY end-of-month) to the canonical first day
# of the same month.
def _parse_eomonth(value):
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    # Accept "DD-MM-YY", "DD-MM-YYYY", or already-ISO strings.
    parts = s.split("-")
    if len(parts) == 3 and len(parts[2]) == 2:
        # Two-digit year — pivot at 70 (matches Python's strptime %y default).
        yy = int(parts[2])
        year = 2000 + yy if yy < 70 else 1900 + yy
        return date(year, int(parts[1]), 1)
    try:
        d = getdate(s)
        return date(d.year, d.month, 1)
    except Exception:
        return None


def _parse_amount(value):
    if value is None:
        return 0.0
    s = str(value).strip().replace(",", "").replace('"', "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _default_csv_path():
    """Return the path to the seed CSV that ships with the repo."""
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(here, "Sales Team Target 2026.csv")


def import_sales_targets_from_csv(file_path=None, year=None, replace=True):
    """Bulk-load `Sales Target` rows from a CSV file.

    Intended to be run via:
        bench --site SITE execute \\
            vcl_sales_dashboard.api.sales_targets.import_sales_targets_from_csv

    Args:
        file_path: absolute path to a CSV. Defaults to the seed CSV in repo root.
        year:      restrict deletion (when replace=True) to a single year.
                   When omitted, derived from the first valid row.
        replace:   when True, delete existing rows for the target year before insert.

    Returns dict with insert/skip counts.
    """
    path = file_path or _default_csv_path()
    if not os.path.exists(path):
        frappe.throw(f"CSV not found at {path}")

    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    parsed = []
    skipped = 0
    for raw in rows:
        period = _parse_eomonth(raw.get("EOMONTH"))
        if not period:
            skipped += 1
            continue
        cust = (raw.get("Customer Name") or "").strip()
        if not cust:
            skipped += 1
            continue
        amount = _parse_amount(raw.get(_AMOUNT_COL))
        parsed.append({
            "period_month": period,
            "period_key": f"{period.year}-{period.month:02d}",
            "customer_name_text": cust,
            "product_level_1": (raw.get("Product Level 1") or "").strip(),
            "product_level_2": (raw.get("Product Level 2") or "").strip(),
            "product_level_3": (raw.get("Product Level 3") or "").strip(),
            "product_level_4": (raw.get("Product Level 4") or "").strip(),
            "target_amount": amount,
            "comment": (raw.get("Comment") or "").strip(),
        })

    if replace:
        delete_year = year or (parsed[0]["period_month"].year if parsed else None)
        if delete_year:
            frappe.db.sql(
                "DELETE FROM `tabSales Target` WHERE YEAR(period_month) = %s",
                (int(delete_year),),
            )

    inserted = 0
    for row in parsed:
        doc = frappe.new_doc("Sales Target")
        doc.update(row)
        doc.insert(ignore_permissions=True)
        inserted += 1

    frappe.db.commit()

    return {
        "status": "ok",
        "inserted": inserted,
        "skipped": skipped,
        "source": path,
    }


@frappe.whitelist()
def import_sales_targets_csv(file_path=None, year=None, replace=1):
    """Whitelisted wrapper around `import_sales_targets_from_csv`.
    System Manager only."""
    frappe.only_for("System Manager")
    return import_sales_targets_from_csv(
        file_path=file_path,
        year=int(year) if year else None,
        replace=bool(int(replace)),
    )
