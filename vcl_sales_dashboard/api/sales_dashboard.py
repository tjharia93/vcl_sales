import frappe
import json
import os
from frappe.utils import today, getdate, add_days, get_first_day, flt, cint


def get_role_filter():
    """Returns user email for Sales Rep filtering, or None for managers."""
    user = frappe.session.user
    roles = frappe.get_roles(user)
    if any(r in roles for r in ["Sales Manager", "Finance Manager", "System Manager"]):
        return None
    return user


def apply_filters_to_conditions(filters, conditions, values, table_alias=""):
    """Apply common filters to SQL conditions list."""
    prefix = f"{table_alias}." if table_alias else ""

    if filters:
        if filters.get("date_from"):
            conditions.append(f"{prefix}transaction_date >= %(date_from)s")
            values["date_from"] = filters["date_from"]
        if filters.get("date_to"):
            conditions.append(f"{prefix}transaction_date <= %(date_to)s")
            values["date_to"] = filters["date_to"]
        if filters.get("territory"):
            conditions.append(f"{prefix}territory = %(territory)s")
            values["territory"] = filters["territory"]
        if filters.get("customer_group"):
            conditions.append(f"{prefix}customer_group = %(customer_group)s")
            values["customer_group"] = filters["customer_group"]


def apply_owner_filter(role_filter, filters, conditions, values, table_alias=""):
    """Apply CSR-based filtering. Uses Customer Sales Rep Assignment to filter by customer."""
    prefix = f"{table_alias}." if table_alias else ""
    csr_map = get_csr_map()

    # Determine which sales rep to filter by
    target_rep = None
    if role_filter:
        target_rep = role_filter
    elif filters and filters.get("my_records"):
        target_rep = frappe.session.user

    if filters and filters.get("sales_rep"):
        target_rep = filters["sales_rep"]

    if target_rep:
        rep_customers = [c for c, r in csr_map.items() if r == target_rep]
        if rep_customers:
            ph = ", ".join([f"%(csr_c{i})s" for i in range(len(rep_customers))])
            conditions.append(f"{prefix}customer IN ({ph})")
            for i, c in enumerate(rep_customers):
                values[f"csr_c{i}"] = c
        else:
            conditions.append("1 = 0")  # No customers assigned


def get_csr_map(as_of_date=None):
    """Return dict of {customer: sales_representative} from Customer Sales Rep Assignment.
    Uses the active assignment with highest priority for each customer as of the given date."""
    if not as_of_date:
        as_of_date = today()

    assignments = frappe.db.sql("""
        SELECT customer, sales_representative, priority
        FROM `tabCustomer Sales Rep Assignment`
        WHERE status = 'Active'
          AND effective_from <= %(as_of)s
          AND (effective_to IS NULL OR effective_to = '' OR effective_to >= %(as_of)s)
        ORDER BY customer, priority ASC
    """, {"as_of": as_of_date}, as_dict=True)

    csr_map = {}
    for row in assignments:
        cust = row.get("customer")
        if cust and cust not in csr_map:
            csr_map[cust] = row.get("sales_representative") or ""
    return csr_map


def get_customers_for_rep(sales_rep, as_of_date=None):
    """Return list of customer names assigned to a sales rep as of the given date."""
    csr_map = get_csr_map(as_of_date)
    return [cust for cust, rep in csr_map.items() if rep == sales_rep]


@frappe.whitelist()
def get_filter_options():
    """Return filter dropdown options for sales reps (from CSR Assignment), territories, customer groups."""
    try:
        # Get distinct active sales reps from Customer Sales Rep Assignment
        sales_reps = frappe.db.sql("""
            SELECT DISTINCT sales_representative as name, sales_representative as full_name
            FROM `tabCustomer Sales Rep Assignment`
            WHERE status = 'Active'
              AND sales_representative IS NOT NULL
              AND sales_representative != ''
            ORDER BY sales_representative
        """, as_dict=True)

        # Fallback to Sales Person doctype if CSR Assignment is empty
        if not sales_reps:
            sales_reps = frappe.get_all(
                "Sales Person",
                fields=["name", "sales_person_name as full_name"],
                order_by="name"
            )

        territories = frappe.get_all(
            "Territory",
            filters={"is_group": 0},
            fields=["name"],
            order_by="name"
        )

        customer_groups = frappe.get_all(
            "Customer Group",
            filters={"is_group": 0},
            fields=["name"],
            order_by="name"
        )

        return {
            "status": "ok",
            "data": {
                "sales_reps": sales_reps,
                "territories": territories,
                "customer_groups": customer_groups
            }
        }
    except Exception as e:
        frappe.log_error(f"get_filter_options error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_sales_dashboard_summary(filters=None):
    """Return KPI summary: open quotes, open orders, overdue invoices, collections MTD."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()

        # Open Quotations
        q_conditions = ["docstatus = 1", "status = 'Open'"]
        q_values = {}
        apply_owner_filter(role_filter, filters, q_conditions, q_values)
        apply_filters_to_conditions(filters, q_conditions, q_values)

        q_where = " AND ".join(q_conditions)
        q_result = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total
            FROM `tabQuotation`
            WHERE {q_where}
        """, q_values, as_dict=True)[0]

        # Open Sales Orders
        so_conditions = [
            "docstatus = 1",
            "status NOT IN ('Cancelled', 'Closed', 'Completed')"
        ]
        so_values = {}
        apply_owner_filter(role_filter, filters, so_conditions, so_values)
        apply_filters_to_conditions(filters, so_conditions, so_values)

        so_where = " AND ".join(so_conditions)
        so_result = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(grand_total), 0) as total
            FROM `tabSales Order`
            WHERE {so_where}
        """, so_values, as_dict=True)[0]

        # Overdue Invoices
        si_conditions = [
            "docstatus = 1",
            "outstanding_amount > 0",
            "due_date < %(today)s"
        ]
        si_values = {"today": today()}
        apply_owner_filter(role_filter, filters, si_conditions, si_values)

        si_where = " AND ".join(si_conditions)
        si_result = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(outstanding_amount), 0) as total
            FROM `tabSales Invoice`
            WHERE {si_where}
        """, si_values, as_dict=True)[0]

        # Collections MTD
        pe_conditions = [
            "docstatus = 1",
            "payment_type = 'Receive'",
            "posting_date >= %(month_start)s"
        ]
        pe_values = {"month_start": get_first_day(today())}
        apply_owner_filter(role_filter, filters, pe_conditions, pe_values)

        pe_where = " AND ".join(pe_conditions)
        pe_result = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt, COALESCE(SUM(paid_amount), 0) as total
            FROM `tabPayment Entry`
            WHERE {pe_where}
        """, pe_values, as_dict=True)[0]

        return {
            "status": "ok",
            "data": {
                "open_quotations_count": cint(q_result.cnt),
                "open_quotations_value": flt(q_result.total),
                "open_orders_count": cint(so_result.cnt),
                "open_orders_value": flt(so_result.total),
                "overdue_invoice_count": cint(si_result.cnt),
                "overdue_invoice_value": flt(si_result.total),
                "collections_mtd": flt(pe_result.total),
                "collections_mtd_count": cint(pe_result.cnt),
            }
        }
    except Exception as e:
        frappe.log_error(f"get_sales_dashboard_summary error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_sales_action_queue(filters=None):
    """Return prioritised action queue: overdue invoices, expiring quotes, uninvoiced deliveries, open quotes."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()
        csr_map = get_csr_map()
        actions = []

        # a) Overdue invoices
        si_conditions = [
            "si.docstatus IN (0, 1)",
            "si.outstanding_amount > 0",
            "si.due_date < %(today)s"
        ]
        si_values = {"today": today()}
        apply_owner_filter(role_filter, filters, si_conditions, si_values, "si")

        si_where = " AND ".join(si_conditions)
        overdue_invoices = frappe.db.sql(f"""
            SELECT
                si.customer, si.customer_name,
                'overdue' as stage,
                'Sales Invoice' as doctype,
                si.name as docname,
                DATEDIFF(%(today)s, si.due_date) as age_days,
                si.status,
                'Escalate' as recommended_action
            FROM `tabSales Invoice` si
            WHERE {si_where}
            ORDER BY si.due_date ASC
            LIMIT 50
        """, si_values, as_dict=True)
        actions.extend(overdue_invoices)

        # b) Expiring quotations (valid_till <= today + 3 days)
        eq_conditions = [
            "q.docstatus IN (0, 1)",
            "q.status = 'Open'",
            "q.valid_till <= %(expiry_threshold)s",
            "q.valid_till >= %(today)s"
        ]
        eq_values = {"today": today(), "expiry_threshold": add_days(today(), 3)}
        apply_owner_filter(role_filter, filters, eq_conditions, eq_values, "q")

        eq_where = " AND ".join(eq_conditions)
        expiring_quotes = frappe.db.sql(f"""
            SELECT
                q.customer, q.customer_name,
                'expiring' as stage,
                'Quotation' as doctype,
                q.name as docname,
                DATEDIFF(%(today)s, q.transaction_date) as age_days,
                q.status,
                'Follow Up' as recommended_action
            FROM `tabQuotation` q
            WHERE {eq_where}
            ORDER BY q.valid_till ASC
            LIMIT 50
        """, eq_values, as_dict=True)
        actions.extend(expiring_quotes)

        # c) Delivered but not invoiced
        dni_conditions = [
            "so.docstatus IN (0, 1)",
            "so.per_delivered = 100",
            "so.per_billed < 100"
        ]
        dni_values = {"today": today()}
        apply_owner_filter(role_filter, filters, dni_conditions, dni_values, "so")

        dni_where = " AND ".join(dni_conditions)
        not_invoiced = frappe.db.sql(f"""
            SELECT
                so.customer, so.customer_name,
                'not_invoiced' as stage,
                'Sales Order' as doctype,
                so.name as docname,
                DATEDIFF(%(today)s, so.transaction_date) as age_days,
                so.status,
                'Raise Invoice' as recommended_action
            FROM `tabSales Order` so
            WHERE {dni_where}
            ORDER BY so.transaction_date ASC
            LIMIT 50
        """, dni_values, as_dict=True)
        actions.extend(not_invoiced)

        # d) Delayed deliveries
        dd_conditions = [
            "so.docstatus IN (0, 1)",
            "so.per_delivered < 100",
            "so.delivery_date < %(today)s",
            "so.status NOT IN ('Cancelled', 'Closed', 'Completed')"
        ]
        dd_values = {"today": today()}
        apply_owner_filter(role_filter, filters, dd_conditions, dd_values, "so")

        dd_where = " AND ".join(dd_conditions)
        delayed = frappe.db.sql(f"""
            SELECT
                so.customer, so.customer_name,
                'delayed' as stage,
                'Sales Order' as doctype,
                so.name as docname,
                DATEDIFF(%(today)s, so.delivery_date) as age_days,
                so.status,
                'Confirm Delivery' as recommended_action
            FROM `tabSales Order` so
            WHERE {dd_where}
            ORDER BY so.delivery_date ASC
            LIMIT 50
        """, dd_values, as_dict=True)
        actions.extend(delayed)

        # e) Open quotations (not expiring soon)
        oq_conditions = [
            "q.docstatus IN (0, 1)",
            "q.status = 'Open'",
            "q.valid_till > %(expiry_threshold)s"
        ]
        oq_values = {"today": today(), "expiry_threshold": add_days(today(), 3)}
        apply_owner_filter(role_filter, filters, oq_conditions, oq_values, "q")

        oq_where = " AND ".join(oq_conditions)
        open_quotes = frappe.db.sql(f"""
            SELECT
                q.customer, q.customer_name,
                'open' as stage,
                'Quotation' as doctype,
                q.name as docname,
                DATEDIFF(%(today)s, q.transaction_date) as age_days,
                q.status,
                'Follow Up' as recommended_action
            FROM `tabQuotation` q
            WHERE {oq_where}
            ORDER BY q.valid_till ASC
            LIMIT 50
        """, oq_values, as_dict=True)
        actions.extend(open_quotes)

        # Trim to 50 total (priority order is maintained by append order)
        actions = actions[:50]

        # Enrich with sales rep from CSR Assignment and N/A-safe
        for row in actions:
            row["sales_rep"] = csr_map.get(row.get("customer"), "")
            row["sales_rep_name"] = row["sales_rep"]
            for key in row:
                if row[key] is None:
                    row[key] = "" if isinstance(row.get(key), str) else 0

        return {"status": "ok", "data": actions}
    except Exception as e:
        frappe.log_error(f"get_sales_action_queue error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_open_quotations(filters=None):
    """Return open quotations with computed days_open and quotation_status."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()

        conditions = ["q.docstatus = 1", "q.status IN ('Open')"]
        values = {"today": today(), "expiry_threshold": add_days(today(), 3)}
        apply_owner_filter(role_filter, filters, conditions, values, "q")
        apply_filters_to_conditions(filters, conditions, values, "q")

        if filters and filters.get("overdue_only"):
            conditions.append("q.valid_till < %(today)s")

        where = " AND ".join(conditions)
        quotations = frappe.db.sql(f"""
            SELECT
                q.name, q.customer, q.customer_name,
                q.transaction_date, q.valid_till,
                q.grand_total, q.status, q.owner,
                DATEDIFF(%(today)s, q.transaction_date) as days_open,
                CASE
                    WHEN q.valid_till < %(today)s THEN 'Expired'
                    WHEN q.valid_till <= %(expiry_threshold)s THEN 'Expiring Soon'
                    ELSE 'Open'
                END as quotation_status
            FROM `tabQuotation` q
            WHERE {where}
            ORDER BY q.valid_till ASC
            LIMIT 50
        """, values, as_dict=True)

        # N/A-safe
        for row in quotations:
            row["grand_total"] = flt(row.get("grand_total"))
            row["days_open"] = cint(row.get("days_open"))
            if not row.get("valid_till"):
                row["valid_till"] = ""
            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")

        return {"status": "ok", "data": quotations}
    except Exception as e:
        frappe.log_error(f"get_open_quotations error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_open_sales_orders(filters=None):
    """Return open sales orders with computed order_status."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()

        conditions = [
            "so.docstatus = 1",
            "so.status NOT IN ('Cancelled', 'Closed', 'Completed')"
        ]
        values = {"today": today()}
        apply_owner_filter(role_filter, filters, conditions, values, "so")
        apply_filters_to_conditions(filters, conditions, values, "so")

        where = " AND ".join(conditions)
        orders = frappe.db.sql(f"""
            SELECT
                so.name, so.customer, so.customer_name,
                so.transaction_date, so.grand_total,
                so.per_delivered, so.per_billed,
                so.delivery_date, so.status, so.owner,
                CASE
                    WHEN so.delivery_date < %(today)s AND so.per_delivered < 100 THEN 'Delayed'
                    WHEN so.per_delivered = 100 AND so.per_billed < 100 THEN 'Not Invoiced'
                    ELSE 'In Progress'
                END as order_status
            FROM `tabSales Order` so
            WHERE {where}
            ORDER BY so.delivery_date ASC
            LIMIT 50
        """, values, as_dict=True)

        # N/A-safe
        for row in orders:
            row["grand_total"] = flt(row.get("grand_total"))
            row["per_delivered"] = flt(row.get("per_delivered"))
            row["per_billed"] = flt(row.get("per_billed"))
            if not row.get("delivery_date"):
                row["delivery_date"] = ""
            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")

        return {"status": "ok", "data": orders}
    except Exception as e:
        frappe.log_error(f"get_open_sales_orders error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_collections_alerts(filters=None):
    """Return aggregated customer collection data with ageing buckets."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()
        csr_map = get_csr_map()

        # Build customer filter from CSR Assignment
        customer_condition = ""
        extra_values = {}

        target_rep = None
        if role_filter:
            target_rep = role_filter
        elif filters and filters.get("my_records"):
            target_rep = frappe.session.user
        if filters and filters.get("sales_rep"):
            target_rep = filters["sales_rep"]

        if target_rep:
            rep_customers = [c for c, r in csr_map.items() if r == target_rep]
            if rep_customers:
                ph = ", ".join([f"%(csr_c{i})s" for i in range(len(rep_customers))])
                customer_condition = f"AND si.customer IN ({ph})"
                for i, c in enumerate(rep_customers):
                    extra_values[f"csr_c{i}"] = c
            else:
                customer_condition = "AND 1 = 0"

        territory_condition = ""
        if filters and filters.get("territory"):
            territory_condition = "AND si.territory = %(territory)s"
            extra_values["territory"] = filters["territory"]

        group_condition = ""
        if filters and filters.get("customer_group"):
            group_condition = "AND si.customer_group = %(customer_group)s"
            extra_values["customer_group"] = filters["customer_group"]

        customers = frappe.db.sql(f"""
            SELECT
                si.customer,
                si.customer_name,
                SUM(si.outstanding_amount) as outstanding_amount,
                SUM(CASE WHEN si.due_date < CURDATE() THEN si.outstanding_amount ELSE 0 END) as overdue_amount,
                SUM(CASE WHEN DATEDIFF(CURDATE(), si.due_date) BETWEEN 0 AND 30 THEN si.outstanding_amount ELSE 0 END) as days_0_30,
                SUM(CASE WHEN DATEDIFF(CURDATE(), si.due_date) BETWEEN 31 AND 60 THEN si.outstanding_amount ELSE 0 END) as days_31_60,
                SUM(CASE WHEN DATEDIFF(CURDATE(), si.due_date) > 60 THEN si.outstanding_amount ELSE 0 END) as days_60_plus,
                MAX(DATEDIFF(CURDATE(), si.due_date)) as oldest_invoice_age_days
            FROM `tabSales Invoice` si
            WHERE si.docstatus IN (0, 1)
              AND si.outstanding_amount > 0
              {customer_condition}
              {territory_condition}
              {group_condition}
            GROUP BY si.customer, si.customer_name
            HAVING SUM(si.outstanding_amount) > 0
            ORDER BY overdue_amount DESC
            LIMIT 50
        """, extra_values, as_dict=True)

        # Enrich with last payment date and sales rep from CSR Assignment
        for row in customers:
            last_payment = frappe.db.sql("""
                SELECT posting_date
                FROM `tabPayment Entry`
                WHERE party = %(customer)s
                  AND payment_type = 'Receive'
                  AND docstatus = 1
                ORDER BY posting_date DESC
                LIMIT 1
            """, {"customer": row.customer}, as_dict=True)

            row["last_payment_date"] = str(last_payment[0].posting_date) if last_payment else ""
            row["outstanding_amount"] = flt(row.get("outstanding_amount"))
            row["overdue_amount"] = flt(row.get("overdue_amount"))
            row["days_0_30"] = flt(row.get("days_0_30"))
            row["days_31_60"] = flt(row.get("days_31_60"))
            row["days_60_plus"] = flt(row.get("days_60_plus"))
            row["oldest_invoice_age_days"] = cint(row.get("oldest_invoice_age_days"))

            # Sales rep from CSR Assignment
            row["sales_rep_name"] = csr_map.get(row.get("customer"), "")
            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")

        return {"status": "ok", "data": customers}
    except Exception as e:
        frappe.log_error(f"get_collections_alerts error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def search_customer_quick(query="", filters=None):
    """Search customers by name, return with outstanding/overdue/order summary."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()
        csr_map = get_csr_map()

        if len(query) < 2:
            result = get_collections_alerts(filters)
            if result.get("status") == "ok":
                return {"status": "ok", "data": result["data"][:10]}
            return result

        # Search customers — filter by CSR assignment for non-managers
        like_query = f"%{query}%"
        customer_condition = ""
        values = {"query": like_query}

        if role_filter:
            rep_customers = [c for c, r in csr_map.items() if r == role_filter]
            if rep_customers:
                ph = ", ".join([f"%(rc{i})s" for i in range(len(rep_customers))])
                customer_condition = f"AND c.name IN ({ph})"
                for i, c in enumerate(rep_customers):
                    values[f"rc{i}"] = c
            else:
                customer_condition = "AND 1 = 0"

        customers = frappe.db.sql(f"""
            SELECT c.name as customer, c.customer_name, c.territory,
                   c.customer_group
            FROM `tabCustomer` c
            WHERE (c.customer_name LIKE %(query)s OR c.name LIKE %(query)s)
              {customer_condition}
            ORDER BY c.customer_name ASC
            LIMIT 10
        """, values, as_dict=True)

        # Enrich each customer
        for row in customers:
            cust = row["customer"]

            outstanding = frappe.db.sql("""
                SELECT COALESCE(SUM(outstanding_amount), 0) as total
                FROM `tabSales Invoice`
                WHERE customer = %(cust)s AND docstatus IN (0, 1)
            """, {"cust": cust}, as_dict=True)
            row["outstanding_amount"] = flt(outstanding[0].total) if outstanding else 0

            overdue = frappe.db.sql("""
                SELECT COALESCE(SUM(outstanding_amount), 0) as total,
                       MAX(DATEDIFF(CURDATE(), due_date)) as oldest
                FROM `tabSales Invoice`
                WHERE customer = %(cust)s AND docstatus IN (0, 1)
                  AND outstanding_amount > 0 AND due_date < CURDATE()
            """, {"cust": cust}, as_dict=True)
            row["overdue_amount"] = flt(overdue[0].total) if overdue else 0
            row["oldest_invoice_age_days"] = cint(overdue[0].oldest) if overdue and overdue[0].oldest else 0

            last_payment = frappe.db.sql("""
                SELECT posting_date FROM `tabPayment Entry`
                WHERE party = %(cust)s AND payment_type = 'Receive' AND docstatus = 1
                ORDER BY posting_date DESC LIMIT 1
            """, {"cust": cust}, as_dict=True)
            row["last_payment_date"] = str(last_payment[0].posting_date) if last_payment else ""

            open_orders = frappe.db.count("Sales Order", {
                "customer": cust, "docstatus": ["in", [0, 1]],
                "status": ["not in", ["Cancelled", "Closed", "Completed"]]
            })
            row["open_orders_count"] = cint(open_orders)

            open_quotes = frappe.db.count("Quotation", {
                "customer": cust, "docstatus": ["in", [0, 1]], "status": "Open"
            })
            row["open_quotations_count"] = cint(open_quotes)

            # Sales rep from CSR Assignment
            row["sales_rep_name"] = csr_map.get(cust, "")

            if not row.get("customer_name"):
                row["customer_name"] = row.get("customer", "")
            if not row.get("territory"):
                row["territory"] = ""
            if not row.get("customer_group"):
                row["customer_group"] = ""

        return {"status": "ok", "data": customers}
    except Exception as e:
        frappe.log_error(f"search_customer_quick error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_customer_snapshot(customer):
    """Return a single customer summary with outstanding, overdue, and activity counts."""
    try:
        if not customer:
            return {"status": "error", "message": "Customer is required", "data": {}}

        if not frappe.db.exists("Customer", customer):
            return {"status": "error", "message": "Customer not found", "data": {}}

        # Role-based permission check via CSR Assignment
        role_filter = get_role_filter()
        csr_map = get_csr_map()
        if role_filter:
            assigned_rep = csr_map.get(customer, "")
            if assigned_rep != role_filter:
                return {"status": "error", "message": "Not permitted", "data": {}}

        cust_doc = frappe.db.get_value(
            "Customer", customer,
            ["name", "customer_name", "territory", "customer_group"],
            as_dict=True
        )

        # Sales Person from CSR Assignment
        sales_person = csr_map.get(customer, "")

        # Outstanding
        outstanding = frappe.db.sql("""
            SELECT COALESCE(SUM(outstanding_amount), 0) as total
            FROM `tabSales Invoice`
            WHERE customer = %(cust)s AND docstatus = 1
        """, {"cust": customer}, as_dict=True)

        # Overdue
        overdue = frappe.db.sql("""
            SELECT COALESCE(SUM(outstanding_amount), 0) as total,
                   MAX(DATEDIFF(CURDATE(), due_date)) as oldest
            FROM `tabSales Invoice`
            WHERE customer = %(cust)s AND docstatus = 1
              AND outstanding_amount > 0 AND due_date < CURDATE()
        """, {"cust": customer}, as_dict=True)

        # Last payment
        last_payment = frappe.db.sql("""
            SELECT posting_date FROM `tabPayment Entry`
            WHERE party = %(cust)s AND payment_type = 'Receive' AND docstatus = 1
            ORDER BY posting_date DESC LIMIT 1
        """, {"cust": customer}, as_dict=True)

        # Open orders
        open_orders = frappe.db.count("Sales Order", {
            "customer": customer, "docstatus": 1,
            "status": ["not in", ["Cancelled", "Closed", "Completed"]]
        })

        # Open quotations
        open_quotes = frappe.db.count("Quotation", {
            "customer": customer, "docstatus": 1, "status": "Open"
        })

        data = {
            "customer": cust_doc.get("name", ""),
            "customer_name": cust_doc.get("customer_name", "") or customer,
            "territory": cust_doc.get("territory", "") or "",
            "customer_group": cust_doc.get("customer_group", "") or "",
            "sales_person": sales_person or "",
            "outstanding_amount": flt(outstanding[0].total) if outstanding else 0,
            "overdue_amount": flt(overdue[0].total) if overdue else 0,
            "oldest_invoice_age_days": cint(overdue[0].oldest) if overdue and overdue[0].oldest else 0,
            "last_payment_date": str(last_payment[0].posting_date) if last_payment else "",
            "open_orders_count": cint(open_orders),
            "open_quotations_count": cint(open_quotes),
        }

        return {"status": "ok", "data": data}
    except Exception as e:
        frappe.log_error(f"get_customer_snapshot error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


@frappe.whitelist()
def get_outstanding_invoices(filters=None):
    """Return outstanding Sales Invoices with summary KPIs. Supports sales_person, territory, date, search filters."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        role_filter = get_role_filter()
        csr_map = get_csr_map()

        conditions = ["si.docstatus IN (0, 1)", "si.outstanding_amount > 0"]
        values = {"today": today()}

        # Role-based filter — if sales rep, only show their assigned customers
        if role_filter:
            my_customers = get_customers_for_rep(role_filter)
            if my_customers:
                placeholders = ", ".join([f"%(rc{i})s" for i in range(len(my_customers))])
                conditions.append(f"si.customer IN ({placeholders})")
                for i, c in enumerate(my_customers):
                    values[f"rc{i}"] = c
            else:
                # Fallback to owner
                conditions.append("si.owner = %(role_owner)s")
                values["role_owner"] = role_filter

        # Sales Person filter — use Customer Sales Rep Assignment
        if filters and filters.get("sales_person"):
            rep_customers = get_customers_for_rep(filters["sales_person"])
            if rep_customers:
                placeholders = ", ".join([f"%(sp{i})s" for i in range(len(rep_customers))])
                conditions.append(f"si.customer IN ({placeholders})")
                for i, c in enumerate(rep_customers):
                    values[f"sp{i}"] = c
            else:
                # No customers for this rep — return empty
                conditions.append("1 = 0")

        # Territory filter
        if filters and filters.get("territory"):
            conditions.append("si.territory = %(territory)s")
            values["territory"] = filters["territory"]

        # Date range filter
        if filters and filters.get("date_from"):
            conditions.append("si.posting_date >= %(date_from)s")
            values["date_from"] = filters["date_from"]
        if filters and filters.get("date_to"):
            conditions.append("si.posting_date <= %(date_to)s")
            values["date_to"] = filters["date_to"]

        # Status filter (overdue / not_overdue)
        if filters and filters.get("status_filter") == "overdue":
            conditions.append("si.due_date < %(today)s")
        elif filters and filters.get("status_filter") == "not_overdue":
            conditions.append("si.due_date >= %(today)s")

        # Search filter
        if filters and filters.get("search") and len(filters["search"]) >= 2:
            conditions.append("(si.customer_name LIKE %(search)s OR si.name LIKE %(search)s OR si.customer LIKE %(search)s)")
            values["search"] = f"%{filters['search']}%"

        where = " AND ".join(conditions)

        # Get invoices
        invoices = frappe.db.sql(f"""
            SELECT
                si.name, si.customer, si.customer_name,
                si.posting_date, si.due_date,
                si.grand_total, si.outstanding_amount,
                si.territory, si.owner, si.status,
                CASE WHEN si.due_date < %(today)s THEN 1 ELSE 0 END as is_overdue
            FROM `tabSales Invoice` si
            WHERE {where}
            ORDER BY si.outstanding_amount DESC
            LIMIT 100
        """, values, as_dict=True)

        # Enrich with sales person from CSR Assignment
        for inv in invoices:
            inv["sales_person"] = csr_map.get(inv.get("customer"), "")
            inv["grand_total"] = flt(inv.get("grand_total"))
            inv["outstanding_amount"] = flt(inv.get("outstanding_amount"))
            inv["posting_date"] = str(inv["posting_date"]) if inv.get("posting_date") else ""
            inv["due_date"] = str(inv["due_date"]) if inv.get("due_date") else ""
            if not inv.get("customer_name"):
                inv["customer_name"] = inv.get("customer", "")
            if not inv.get("territory"):
                inv["territory"] = ""

        # Summary KPIs
        summary_sql = frappe.db.sql(f"""
            SELECT
                COUNT(*) as invoice_count,
                COUNT(DISTINCT si.customer) as customer_count,
                COALESCE(SUM(si.outstanding_amount), 0) as total_outstanding,
                COALESCE(SUM(CASE WHEN si.due_date < %(today)s THEN si.outstanding_amount ELSE 0 END), 0) as total_overdue,
                SUM(CASE WHEN si.due_date < %(today)s THEN 1 ELSE 0 END) as overdue_count,
                COUNT(DISTINCT CASE WHEN si.due_date < %(today)s THEN si.customer END) as overdue_customer_count
            FROM `tabSales Invoice` si
            WHERE {where}
        """, values, as_dict=True)[0]

        summary = {
            "invoice_count": cint(summary_sql.invoice_count),
            "customer_count": cint(summary_sql.customer_count),
            "total_outstanding": flt(summary_sql.total_outstanding),
            "total_overdue": flt(summary_sql.total_overdue),
            "overdue_count": cint(summary_sql.overdue_count),
            "overdue_customer_count": cint(summary_sql.overdue_customer_count),
        }

        return {"status": "ok", "data": {"invoices": invoices, "summary": summary}}
    except Exception as e:
        frappe.log_error(f"get_outstanding_invoices error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {"invoices": [], "summary": {}}}


@frappe.whitelist()
def get_net_sales_summary():
    """Return net sales MTD and YTD from submitted Sales Invoices."""
    try:
        month_start = get_first_day(today())
        year_start = getdate(today()).replace(month=1, day=1)

        # MTD
        mtd = frappe.db.sql("""
            SELECT COALESCE(SUM(net_total), 0) as total
            FROM `tabSales Invoice`
            WHERE docstatus IN (0, 1) AND posting_date >= %(month_start)s
        """, {"month_start": month_start}, as_dict=True)[0]

        # YTD
        ytd = frappe.db.sql("""
            SELECT COALESCE(SUM(net_total), 0) as total
            FROM `tabSales Invoice`
            WHERE docstatus IN (0, 1) AND posting_date >= %(year_start)s
        """, {"year_start": year_start}, as_dict=True)[0]

        return {
            "status": "ok",
            "data": {
                "net_sales_mtd": flt(mtd.total),
                "net_sales_ytd": flt(ytd.total),
            }
        }
    except Exception as e:
        frappe.log_error(f"get_net_sales_summary error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


@frappe.whitelist()
def get_sales_by_person():
    """Return net sales by Sales Rep for MTD and YTD using Customer Sales Rep Assignment mapping."""
    try:
        month_start = get_first_day(today())
        year_start = getdate(today()).replace(month=1, day=1)
        csr_map = get_csr_map()

        # MTD invoices
        mtd_invoices = frappe.db.sql("""
            SELECT si.customer, si.net_total
            FROM `tabSales Invoice` si
            WHERE si.docstatus IN (0, 1) AND si.posting_date >= %(month_start)s
        """, {"month_start": month_start}, as_dict=True)

        # YTD invoices
        ytd_invoices = frappe.db.sql("""
            SELECT si.customer, si.net_total
            FROM `tabSales Invoice` si
            WHERE si.docstatus IN (0, 1) AND si.posting_date >= %(year_start)s
        """, {"year_start": year_start}, as_dict=True)

        # Aggregate by sales rep using CSR map
        from collections import defaultdict

        mtd_agg = defaultdict(float)
        for inv in mtd_invoices:
            rep = csr_map.get(inv.customer, "Unassigned")
            mtd_agg[rep] += flt(inv.net_total)

        ytd_agg = defaultdict(float)
        for inv in ytd_invoices:
            rep = csr_map.get(inv.customer, "Unassigned")
            ytd_agg[rep] += flt(inv.net_total)

        mtd_rows = sorted(
            [{"sales_person": k, "net_total": flt(v)} for k, v in mtd_agg.items()],
            key=lambda x: -x["net_total"]
        )
        ytd_rows = sorted(
            [{"sales_person": k, "net_total": flt(v)} for k, v in ytd_agg.items()],
            key=lambda x: -x["net_total"]
        )

        return {
            "status": "ok",
            "data": {
                "mtd": mtd_rows,
                "ytd": ytd_rows,
            }
        }
    except Exception as e:
        frappe.log_error(f"get_sales_by_person error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {"mtd": [], "ytd": []}}


def _load_targets_json():
    """Load the sales targets JSON file."""
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "sales_targets_2026.json"
    )
    if not os.path.exists(data_path):
        return None
    with open(data_path, "r") as f:
        return json.load(f)


@frappe.whitelist()
def get_sales_targets(month=None):
    """Return sales targets for the given month or current month. Includes monthly, by_product, by_customer."""
    try:
        targets = _load_targets_json()
        if not targets:
            return {"status": "error", "message": "Targets file not found", "data": {}}

        if not month:
            d = getdate(today())
            month = f"{d.year}-{d.month:02d}"

        monthly_target = targets.get("monthly_targets", {}).get(month, 0)
        annual_target = targets.get("annual_target", 0)

        # YTD target: sum of all months up to and including current month
        ytd_target = 0
        for m, val in targets.get("monthly_targets", {}).items():
            if m <= month:
                ytd_target += val

        by_product = targets.get("by_product_monthly", {}).get(month, {})
        by_customer = targets.get("by_customer_monthly", {}).get(month, {})

        return {
            "status": "ok",
            "data": {
                "month": month,
                "monthly_target": flt(monthly_target),
                "annual_target": flt(annual_target),
                "ytd_target": flt(ytd_target),
                "by_product": by_product,
                "by_customer": by_customer,
            }
        }
    except Exception as e:
        frappe.log_error(f"get_sales_targets error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


@frappe.whitelist()
def get_sales_rep_discrepancies(filters=None):
    """Compare Sales Person on documents against Customer Sales Rep Assignment. Return mismatches."""
    try:
        if isinstance(filters, str):
            filters = frappe.parse_json(filters)

        csr_map = get_csr_map()

        doctype_filter = filters.get("doctype_filter", "") if filters else ""
        type_filter = filters.get("type_filter", "") if filters else ""
        csr_rep_filter = filters.get("csr_rep", "") if filters else ""

        doctypes_to_check = []
        if doctype_filter:
            doctypes_to_check = [doctype_filter]
        else:
            doctypes_to_check = ["Sales Invoice", "Sales Order", "Quotation"]

        discrepancies = []
        total_checked = 0

        for dt in doctypes_to_check:
            date_field = "posting_date" if dt == "Sales Invoice" else "transaction_date"

            docs = frappe.db.sql(f"""
                SELECT name, customer, customer_name, {date_field} as doc_date
                FROM `tab{dt}`
                WHERE docstatus IN (0, 1)
                ORDER BY {date_field} DESC
                LIMIT 500
            """, as_dict=True)

            for doc in docs:
                total_checked += 1
                customer = doc.get("customer", "")
                csr_rep = csr_map.get(customer, "")

                # Get sales person from Sales Team child on this document
                doc_sp = frappe.db.get_value(
                    "Sales Team",
                    {"parent": doc["name"], "parenttype": dt},
                    "sales_person"
                ) or ""

                # Filter by CSR rep if specified
                if csr_rep_filter and csr_rep != csr_rep_filter:
                    continue

                disc_type = None

                if not csr_rep and not doc_sp:
                    disc_type = "no_csr_assignment"
                elif csr_rep and not doc_sp:
                    disc_type = "missing_on_doc"
                elif not csr_rep and doc_sp:
                    disc_type = "no_csr_assignment"
                elif csr_rep and doc_sp and csr_rep.strip().lower() != doc_sp.strip().lower():
                    disc_type = "mismatch"

                if disc_type:
                    if type_filter and disc_type != type_filter:
                        continue

                    row = {
                        "doctype": dt,
                        "docname": doc["name"],
                        "customer": customer,
                        "customer_name": doc.get("customer_name") or customer,
                        "doc_sales_person": doc_sp,
                        "csr_sales_person": csr_rep,
                        "disc_type": disc_type,
                    }
                    if dt == "Sales Invoice":
                        row["posting_date"] = str(doc.get("doc_date", ""))
                    else:
                        row["transaction_date"] = str(doc.get("doc_date", ""))

                    discrepancies.append(row)

        # Sort: mismatches first, then missing, then unassigned
        order = {"mismatch": 0, "missing_on_doc": 1, "no_csr_assignment": 2}
        discrepancies.sort(key=lambda x: order.get(x.get("disc_type"), 3))

        # Summary
        mismatch_count = sum(1 for d in discrepancies if d["disc_type"] == "mismatch")
        missing_count = sum(1 for d in discrepancies if d["disc_type"] == "missing_on_doc")
        no_csr_count = sum(1 for d in discrepancies if d["disc_type"] == "no_csr_assignment")

        return {
            "status": "ok",
            "data": {
                "discrepancies": discrepancies[:200],
                "summary": {
                    "total_checked": total_checked,
                    "mismatch_count": mismatch_count,
                    "missing_on_doc_count": missing_count,
                    "no_csr_count": no_csr_count,
                }
            }
        }
    except Exception as e:
        frappe.log_error(f"get_sales_rep_discrepancies error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {"discrepancies": [], "summary": {}}}
