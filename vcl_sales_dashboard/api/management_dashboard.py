import frappe
from frappe.utils import today, getdate, add_days, get_first_day, flt, cint
from vcl_sales_dashboard.api.sales_dashboard import get_csr_map


def get_role_filter():
    """Management dashboard is restricted to Sales Manager / Finance Manager / System Manager."""
    user = frappe.session.user
    roles = frappe.get_roles(user)
    if not any(r in roles for r in ["Sales Manager", "Finance Manager", "System Manager"]):
        frappe.throw("Not permitted", frappe.PermissionError)
    return None  # Managers see all records


def apply_management_filters(conditions, values, filters, table_alias=""):
    """Apply territory, customer_group, and date filters for management views."""
    prefix = f"{table_alias}." if table_alias else ""

    if filters:
        if filters.get("territory"):
            conditions.append(f"{prefix}territory = %(territory)s")
            values["territory"] = filters["territory"]
        if filters.get("customer_group"):
            conditions.append(f"{prefix}customer_group = %(customer_group)s")
            values["customer_group"] = filters["customer_group"]
        if filters.get("date_from"):
            conditions.append(f"{prefix}posting_date >= %(date_from)s")
            values["date_from"] = filters["date_from"]
        if filters.get("date_to"):
            conditions.append(f"{prefix}posting_date <= %(date_to)s")
            values["date_to"] = filters["date_to"]


@frappe.whitelist()
def get_rep_performance(filters=None):
    """Return sales rep performance: sales MTD, collections MTD, open quotes, overdue."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        get_role_filter()  # Permission check
        csr_map = get_csr_map()

        month_start = get_first_day(today())
        from collections import defaultdict

        territory_condition = ""
        extra_values = {"month_start": month_start, "today": today()}

        if filters and filters.get("territory"):
            territory_condition = "AND territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Sales MTD — aggregate by CSR rep (Draft + Submitted)
        sales_mtd = frappe.db.sql(f"""
            SELECT customer, SUM(grand_total) as total
            FROM `tabSales Invoice`
            WHERE docstatus IN (0, 1)
              AND posting_date >= %(month_start)s
              {territory_condition}
            GROUP BY customer
        """, extra_values, as_dict=True)
        sales_by_rep = defaultdict(float)
        for r in sales_mtd:
            rep = csr_map.get(r.customer, "Unassigned")
            sales_by_rep[rep] += flt(r.total)

        # Collections MTD — aggregate by CSR rep (via party = customer)
        collections_mtd = frappe.db.sql(f"""
            SELECT party as customer, SUM(paid_amount) as total
            FROM `tabPayment Entry`
            WHERE docstatus = 1
              AND payment_type = 'Receive'
              AND posting_date >= %(month_start)s
            GROUP BY party
        """, extra_values, as_dict=True)
        collections_by_rep = defaultdict(float)
        for r in collections_mtd:
            rep = csr_map.get(r.customer, "Unassigned")
            collections_by_rep[rep] += flt(r.total)

        # Open quotes — aggregate by CSR rep
        open_quotes = frappe.db.sql(f"""
            SELECT customer, SUM(grand_total) as total
            FROM `tabQuotation`
            WHERE docstatus IN (0, 1) AND status = 'Open'  -- Draft + submitted: intentional for pipeline tracking
              {territory_condition}
            GROUP BY customer
        """, extra_values, as_dict=True)
        quotes_by_rep = defaultdict(float)
        for r in open_quotes:
            rep = csr_map.get(r.customer, "Unassigned")
            quotes_by_rep[rep] += flt(r.total)

        # Overdue — aggregate by CSR rep
        overdue = frappe.db.sql(f"""
            SELECT customer, SUM(outstanding_amount) as total
            FROM `tabSales Invoice`
            WHERE docstatus = 1
              AND outstanding_amount > 0
              AND due_date < %(today)s
              {territory_condition}
            GROUP BY customer
        """, extra_values, as_dict=True)
        overdue_by_rep = defaultdict(lambda: {"value": 0, "customers": set()})
        for r in overdue:
            rep = csr_map.get(r.customer, "Unassigned")
            overdue_by_rep[rep]["value"] += flt(r.total)
            overdue_by_rep[rep]["customers"].add(r.customer)

        # Combine all reps
        all_reps = set(sales_by_rep.keys()) | set(collections_by_rep.keys()) | set(quotes_by_rep.keys()) | set(overdue_by_rep.keys())

        result = []
        for rep in all_reps:
            overdue_data = overdue_by_rep.get(rep, {"value": 0, "customers": set()})
            result.append({
                "sales_rep": rep,
                "sales_rep_name": rep,
                "sales_mtd": sales_by_rep.get(rep, 0),
                "collections_mtd": collections_by_rep.get(rep, 0),
                "open_quotes_value": quotes_by_rep.get(rep, 0),
                "overdue_customers": len(overdue_data["customers"]),
                "overdue_value": overdue_data["value"],
            })

        result.sort(key=lambda x: x["overdue_value"], reverse=True)

        return {"status": "ok", "data": result}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_rep_performance error")
        return {"status": "error", "message": "An error occurred. Please try again.", "data": []}


@frappe.whitelist()
def get_pipeline_summary(filters=None):
    """Return pipeline counts and values for opportunities, quotations, and sales orders."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        get_role_filter()  # Permission check

        territory_condition = ""
        extra_values = {}
        if filters and filters.get("territory"):
            territory_condition = "AND territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Opportunities (may not exist in all ERPNext setups)
        try:
            opportunities = frappe.db.sql(f"""
                SELECT COUNT(*) as cnt, COALESCE(SUM(opportunity_amount), 0) as total
                FROM `tabOpportunity`
                WHERE status NOT IN ('Lost', 'Closed')
                  {territory_condition}
            """, extra_values, as_dict=True)[0]
            opp_count = cint(opportunities.cnt)
            opp_value = flt(opportunities.total)
        except Exception:
            opp_count = 0
            opp_value = 0

        # Open Quotations
        quotations = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total
            FROM `tabQuotation`
            WHERE docstatus = 1 AND status = 'Open'
              {territory_condition}
        """, extra_values, as_dict=True)[0]

        # Open Sales Orders
        orders = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total
            FROM `tabSales Order`
            WHERE docstatus = 1
              AND status NOT IN ('Cancelled', 'Closed', 'Completed')
              {territory_condition}
        """, extra_values, as_dict=True)[0]

        return {
            "status": "ok",
            "data": {
                "opportunities": {"count": opp_count, "value": opp_value},
                "quotations": {"count": cint(quotations.cnt), "value": flt(quotations.total)},
                "orders": {"count": cint(orders.cnt), "value": flt(orders.total)},
            }
        }
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": {}}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_pipeline_summary error")
        return {"status": "error", "message": "An error occurred. Please try again.", "data": {}}


@frappe.whitelist()
def get_team_collection_risk(filters=None):
    """Return overdue by rep and top overdue customers."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        get_role_filter()  # Permission check
        csr_map = get_csr_map()
        from collections import defaultdict

        territory_condition = ""
        extra_values = {"today": today()}
        if filters and filters.get("territory"):
            territory_condition = "AND si.territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Get overdue invoices grouped by customer
        overdue_raw = frappe.db.sql(f"""
            SELECT
                si.customer,
                si.customer_name,
                SUM(si.outstanding_amount) as overdue_amount,
                MAX(DATEDIFF(%(today)s, si.due_date)) as oldest_age
            FROM `tabSales Invoice` si
            WHERE si.docstatus = 1
              AND si.outstanding_amount > 0
              AND si.due_date < %(today)s
              {territory_condition}
            GROUP BY si.customer, si.customer_name
            ORDER BY overdue_amount DESC
        """, extra_values, as_dict=True)

        # Aggregate by CSR rep
        rep_agg = defaultdict(lambda: {"overdue_amount": 0, "customers": set()})
        for row in overdue_raw:
            rep = csr_map.get(row.customer, "Unassigned")
            rep_agg[rep]["overdue_amount"] += flt(row.overdue_amount)
            rep_agg[rep]["customers"].add(row.customer)

        overdue_by_rep = sorted([
            {"sales_rep": rep, "sales_rep_name": rep, "overdue_amount": flt(d["overdue_amount"]), "customer_count": len(d["customers"])}
            for rep, d in rep_agg.items()
        ], key=lambda x: -x["overdue_amount"])

        # Top overdue customers with CSR rep
        top_customers = overdue_raw[:10]
        for row in top_customers:
            row["overdue_amount"] = flt(row.get("overdue_amount"))
            row["oldest_age"] = cint(row.get("oldest_age"))
            row["sales_rep"] = csr_map.get(row.get("customer"), "")
            row["sales_rep_name"] = row["sales_rep"]
            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")

        return {
            "status": "ok",
            "data": {
                "overdue_by_rep": overdue_by_rep,
                "top_overdue_customers": top_customers
            }
        }
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": {}}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_team_collection_risk error")
        return {"status": "error", "message": "An error occurred. Please try again.", "data": {}}


@frappe.whitelist()
def get_key_sales_exceptions(filters=None):
    """Return key exceptions: large expiring quotes, delayed orders, high overdue, uninvoiced deliveries."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        get_role_filter()  # Permission check

        exceptions = []
        today_date = today()
        threshold_7d = add_days(today_date, 7)

        territory_condition = ""
        extra_values = {"today": today_date, "threshold_7d": threshold_7d, "three_days_ago": add_days(today_date, -3)}
        if filters and filters.get("territory"):
            territory_condition = "AND territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Large quotes expiring within 7 days (grand_total > 500,000)
        large_quotes = frappe.db.sql(f"""
            SELECT
                'Large Quote Expiring' as exception_type,
                customer, customer_name,
                name as docname,
                grand_total as amount,
                DATEDIFF(%(today)s, transaction_date) as age_days,
                owner as sales_rep,  -- TODO: Replace owner with CSR Assignment lookup
                'Critical' as urgency
            FROM `tabQuotation`
            WHERE docstatus = 1 AND status = 'Open'
              AND valid_till <= %(threshold_7d)s
              AND grand_total > 500000
              {territory_condition}
            ORDER BY grand_total DESC
        """, extra_values, as_dict=True)
        exceptions.extend(large_quotes)

        # Large orders delayed (grand_total > 500,000)
        large_orders = frappe.db.sql(f"""
            SELECT
                'Large Order Delayed' as exception_type,
                customer, customer_name,
                name as docname,
                grand_total as amount,
                DATEDIFF(%(today)s, delivery_date) as age_days,
                owner as sales_rep,  -- TODO: Replace owner with CSR Assignment lookup
                'Critical' as urgency
            FROM `tabSales Order`
            WHERE docstatus = 1
              AND delivery_date < %(today)s
              AND per_delivered < 100
              AND grand_total > 500000
              AND status NOT IN ('Cancelled', 'Closed', 'Completed')
              {territory_condition}
            ORDER BY grand_total DESC
        """, extra_values, as_dict=True)
        exceptions.extend(large_orders)

        # High overdue accounts (overdue > 1,000,000)
        high_overdue = frappe.db.sql(f"""
            SELECT
                'High Overdue Account' as exception_type,
                customer, customer_name,
                '' as docname,
                SUM(outstanding_amount) as amount,
                MAX(DATEDIFF(%(today)s, due_date)) as age_days,
                owner as sales_rep,  -- TODO: Replace owner with CSR Assignment lookup
                'Critical' as urgency
            FROM `tabSales Invoice`
            WHERE docstatus = 1
              AND outstanding_amount > 0
              AND due_date < %(today)s
              {territory_condition}
            GROUP BY customer, customer_name, owner
            HAVING SUM(outstanding_amount) > 1000000
            ORDER BY amount DESC
        """, extra_values, as_dict=True)
        exceptions.extend(high_overdue)

        # Delivered but not invoiced for more than 3 days
        not_invoiced = frappe.db.sql(f"""
            SELECT
                'Delivered Not Invoiced' as exception_type,
                customer, customer_name,
                name as docname,
                grand_total as amount,
                DATEDIFF(%(today)s, posting_date) as age_days,
                owner as sales_rep,  -- TODO: Replace owner with CSR Assignment lookup
                'High' as urgency
            FROM `tabDelivery Note`
            WHERE docstatus = 1
              AND per_billed < 100
              AND posting_date < %(three_days_ago)s
              {territory_condition}
            ORDER BY grand_total DESC
        """, extra_values, as_dict=True)
        exceptions.extend(not_invoiced)

        # Sort: Critical first, then High, then by amount desc
        urgency_order = {"Critical": 0, "High": 1, "Medium": 2}
        exceptions.sort(key=lambda x: (urgency_order.get(x.get("urgency", "Medium"), 2), -flt(x.get("amount", 0))))

        # N/A-safe and add rep names
        for row in exceptions:
            row["amount"] = flt(row.get("amount"))
            row["age_days"] = cint(row.get("age_days"))
            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")
            if not row.get("docname"):
                row["docname"] = ""

            rep_name = frappe.db.get_value("User", row.get("sales_rep"), "full_name")
            row["sales_rep_name"] = rep_name or row.get("sales_rep", "")

        return {"status": "ok", "data": exceptions}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "get_key_sales_exceptions error")
        return {"status": "error", "message": "An error occurred. Please try again.", "data": []}
