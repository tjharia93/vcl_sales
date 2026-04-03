import frappe
from frappe.utils import today, getdate, add_days, get_first_day, flt, cint


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

        month_start = get_first_day(today())

        territory_condition = ""
        extra_values = {"month_start": month_start, "today": today()}

        if filters and filters.get("territory"):
            territory_condition = "AND territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Sales MTD by owner
        sales_mtd = frappe.db.sql(f"""
            SELECT owner,
                   SUM(grand_total) as sales_mtd
            FROM `tabSales Invoice`
            WHERE docstatus = 1
              AND posting_date >= %(month_start)s
              {territory_condition}
            GROUP BY owner
        """, extra_values, as_dict=True)
        sales_map = {r.owner: flt(r.sales_mtd) for r in sales_mtd}

        # Collections MTD by owner
        collections_mtd = frappe.db.sql(f"""
            SELECT owner,
                   SUM(paid_amount) as collections_mtd
            FROM `tabPayment Entry`
            WHERE docstatus = 1
              AND payment_type = 'Receive'
              AND posting_date >= %(month_start)s
            GROUP BY owner
        """, extra_values, as_dict=True)
        collections_map = {r.owner: flt(r.collections_mtd) for r in collections_mtd}

        # Open quotes value by owner
        open_quotes = frappe.db.sql(f"""
            SELECT owner,
                   SUM(grand_total) as open_quotes_value
            FROM `tabQuotation`
            WHERE docstatus = 1 AND status = 'Open'
              {territory_condition}
            GROUP BY owner
        """, extra_values, as_dict=True)
        quotes_map = {r.owner: flt(r.open_quotes_value) for r in open_quotes}

        # Overdue by owner
        overdue = frappe.db.sql(f"""
            SELECT owner,
                   SUM(outstanding_amount) as overdue_value,
                   COUNT(DISTINCT customer) as overdue_customers
            FROM `tabSales Invoice`
            WHERE docstatus = 1
              AND outstanding_amount > 0
              AND due_date < %(today)s
              {territory_condition}
            GROUP BY owner
        """, extra_values, as_dict=True)
        overdue_map = {r.owner: {"value": flt(r.overdue_value), "customers": cint(r.overdue_customers)} for r in overdue}

        # Combine all owners
        all_owners = set(sales_map.keys()) | set(collections_map.keys()) | set(quotes_map.keys()) | set(overdue_map.keys())

        result = []
        for owner in all_owners:
            full_name = frappe.db.get_value("User", owner, "full_name") or owner
            overdue_data = overdue_map.get(owner, {"value": 0, "customers": 0})
            result.append({
                "sales_rep": owner,
                "sales_rep_name": full_name,
                "sales_mtd": sales_map.get(owner, 0),
                "collections_mtd": collections_map.get(owner, 0),
                "open_quotes_value": quotes_map.get(owner, 0),
                "overdue_customers": overdue_data["customers"],
                "overdue_value": overdue_data["value"],
            })

        # Sort by overdue value descending
        result.sort(key=lambda x: x["overdue_value"], reverse=True)

        return {"status": "ok", "data": result}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except Exception as e:
        frappe.log_error(f"get_rep_performance error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


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
        frappe.log_error(f"get_pipeline_summary error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


@frappe.whitelist()
def get_team_collection_risk(filters=None):
    """Return overdue by rep and top overdue customers."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        get_role_filter()  # Permission check

        territory_condition = ""
        extra_values = {"today": today()}
        if filters and filters.get("territory"):
            territory_condition = "AND si.territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        # Overdue by rep
        overdue_by_rep = frappe.db.sql(f"""
            SELECT
                si.owner as sales_rep,
                COALESCE(u.full_name, si.owner) as sales_rep_name,
                SUM(si.outstanding_amount) as overdue_amount,
                COUNT(DISTINCT si.customer) as customer_count
            FROM `tabSales Invoice` si
            LEFT JOIN `tabUser` u ON u.name = si.owner
            WHERE si.docstatus = 1
              AND si.outstanding_amount > 0
              AND si.due_date < %(today)s
              {territory_condition}
            GROUP BY si.owner
            ORDER BY overdue_amount DESC
        """, extra_values, as_dict=True)

        for row in overdue_by_rep:
            row["overdue_amount"] = flt(row.get("overdue_amount"))
            row["customer_count"] = cint(row.get("customer_count"))

        # Top overdue customers
        top_customers = frappe.db.sql(f"""
            SELECT
                si.customer,
                si.customer_name,
                SUM(si.outstanding_amount) as overdue_amount,
                MAX(DATEDIFF(%(today)s, si.due_date)) as oldest_age,
                si.owner as sales_rep,
                COALESCE(u.full_name, si.owner) as sales_rep_name
            FROM `tabSales Invoice` si
            LEFT JOIN `tabUser` u ON u.name = si.owner
            WHERE si.docstatus = 1
              AND si.outstanding_amount > 0
              AND si.due_date < %(today)s
              {territory_condition}
            GROUP BY si.customer, si.customer_name, si.owner
            ORDER BY overdue_amount DESC
            LIMIT 10
        """, extra_values, as_dict=True)

        for row in top_customers:
            row["overdue_amount"] = flt(row.get("overdue_amount"))
            row["oldest_age"] = cint(row.get("oldest_age"))
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
        frappe.log_error(f"get_team_collection_risk error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


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
                owner as sales_rep,
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
                owner as sales_rep,
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
                owner as sales_rep,
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
                owner as sales_rep,
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
        frappe.log_error(f"get_key_sales_exceptions error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}
