import frappe
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
    """Apply owner-based filtering for role and my_records toggle."""
    prefix = f"{table_alias}." if table_alias else ""

    if role_filter:
        conditions.append(f"{prefix}owner = %(role_owner)s")
        values["role_owner"] = role_filter
    elif filters and filters.get("my_records"):
        conditions.append(f"{prefix}owner = %(my_user)s")
        values["my_user"] = frappe.session.user

    if filters and filters.get("sales_rep"):
        conditions.append(f"{prefix}owner = %(sales_rep_filter)s")
        values["sales_rep_filter"] = filters["sales_rep"]


@frappe.whitelist()
def get_filter_options():
    """Return filter dropdown options for sales reps, territories, customer groups."""
    try:
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
        actions = []

        # a) Overdue invoices
        si_conditions = [
            "si.docstatus = 1",
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
                'Escalate' as recommended_action,
                si.owner as sales_rep,
                COALESCE(u.full_name, si.owner) as sales_rep_name
            FROM `tabSales Invoice` si
            LEFT JOIN `tabUser` u ON u.name = si.owner
            WHERE {si_where}
            ORDER BY si.due_date ASC
            LIMIT 50
        """, si_values, as_dict=True)
        actions.extend(overdue_invoices)

        # b) Expiring quotations (valid_till <= today + 3 days)
        eq_conditions = [
            "q.docstatus = 1",
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
                'Follow Up' as recommended_action,
                q.owner as sales_rep,
                COALESCE(u.full_name, q.owner) as sales_rep_name
            FROM `tabQuotation` q
            LEFT JOIN `tabUser` u ON u.name = q.owner
            WHERE {eq_where}
            ORDER BY q.valid_till ASC
            LIMIT 50
        """, eq_values, as_dict=True)
        actions.extend(expiring_quotes)

        # c) Delivered but not invoiced
        dni_conditions = [
            "so.docstatus = 1",
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
                'Raise Invoice' as recommended_action,
                so.owner as sales_rep,
                COALESCE(u.full_name, so.owner) as sales_rep_name
            FROM `tabSales Order` so
            LEFT JOIN `tabUser` u ON u.name = so.owner
            WHERE {dni_where}
            ORDER BY so.transaction_date ASC
            LIMIT 50
        """, dni_values, as_dict=True)
        actions.extend(not_invoiced)

        # d) Delayed deliveries
        dd_conditions = [
            "so.docstatus = 1",
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
                'Confirm Delivery' as recommended_action,
                so.owner as sales_rep,
                COALESCE(u.full_name, so.owner) as sales_rep_name
            FROM `tabSales Order` so
            LEFT JOIN `tabUser` u ON u.name = so.owner
            WHERE {dd_where}
            ORDER BY so.delivery_date ASC
            LIMIT 50
        """, dd_values, as_dict=True)
        actions.extend(delayed)

        # e) Open quotations (not expiring soon)
        oq_conditions = [
            "q.docstatus = 1",
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
                'Follow Up' as recommended_action,
                q.owner as sales_rep,
                COALESCE(u.full_name, q.owner) as sales_rep_name
            FROM `tabQuotation` q
            LEFT JOIN `tabUser` u ON u.name = q.owner
            WHERE {oq_where}
            ORDER BY q.valid_till ASC
            LIMIT 50
        """, oq_values, as_dict=True)
        actions.extend(open_quotes)

        # Trim to 50 total (priority order is maintained by append order)
        actions = actions[:50]

        # N/A-safe all fields
        for row in actions:
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

        owner_condition = ""
        extra_values = {}
        if role_filter:
            owner_condition = "AND si.owner = %(role_owner)s"
            extra_values["role_owner"] = role_filter
        elif filters and filters.get("my_records"):
            owner_condition = "AND si.owner = %(my_user)s"
            extra_values["my_user"] = frappe.session.user

        if filters and filters.get("sales_rep"):
            owner_condition += " AND si.owner = %(sales_rep_filter)s"
            extra_values["sales_rep_filter"] = filters["sales_rep"]

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
                MAX(DATEDIFF(CURDATE(), si.due_date)) as oldest_invoice_age_days,
                si.owner
            FROM `tabSales Invoice` si
            WHERE si.docstatus = 1
              AND si.outstanding_amount > 0
              {owner_condition}
              {territory_condition}
              {group_condition}
            GROUP BY si.customer, si.customer_name, si.owner
            HAVING SUM(si.outstanding_amount) > 0
            ORDER BY overdue_amount DESC
            LIMIT 50
        """, extra_values, as_dict=True)

        # Enrich with last payment date and sales rep name
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

            # Sales rep name
            rep_name = frappe.db.get_value("User", row.get("owner"), "full_name")
            row["sales_rep_name"] = rep_name or row.get("owner", "")
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

        if len(query) < 2:
            # Return last 10 customers with outstanding balances
            result = get_collections_alerts(filters)
            if result.get("status") == "ok":
                return {"status": "ok", "data": result["data"][:10]}
            return result

        # Search customers
        like_query = f"%{query}%"
        owner_condition = ""
        values = {"query": like_query}

        if role_filter:
            owner_condition = "AND c.owner = %(role_owner)s"
            values["role_owner"] = role_filter

        customers = frappe.db.sql(f"""
            SELECT c.name as customer, c.customer_name, c.territory,
                   c.customer_group, c.owner
            FROM `tabCustomer` c
            WHERE (c.customer_name LIKE %(query)s OR c.name LIKE %(query)s)
              {owner_condition}
            ORDER BY c.customer_name ASC
            LIMIT 10
        """, values, as_dict=True)

        # Enrich each customer
        for row in customers:
            cust = row["customer"]

            # Outstanding
            outstanding = frappe.db.sql("""
                SELECT COALESCE(SUM(outstanding_amount), 0) as total
                FROM `tabSales Invoice`
                WHERE customer = %(cust)s AND docstatus = 1
            """, {"cust": cust}, as_dict=True)
            row["outstanding_amount"] = flt(outstanding[0].total) if outstanding else 0

            # Overdue
            overdue = frappe.db.sql("""
                SELECT COALESCE(SUM(outstanding_amount), 0) as total,
                       MAX(DATEDIFF(CURDATE(), due_date)) as oldest
                FROM `tabSales Invoice`
                WHERE customer = %(cust)s AND docstatus = 1
                  AND outstanding_amount > 0 AND due_date < CURDATE()
            """, {"cust": cust}, as_dict=True)
            row["overdue_amount"] = flt(overdue[0].total) if overdue else 0
            row["oldest_invoice_age_days"] = cint(overdue[0].oldest) if overdue and overdue[0].oldest else 0

            # Last payment
            last_payment = frappe.db.sql("""
                SELECT posting_date FROM `tabPayment Entry`
                WHERE party = %(cust)s AND payment_type = 'Receive' AND docstatus = 1
                ORDER BY posting_date DESC LIMIT 1
            """, {"cust": cust}, as_dict=True)
            row["last_payment_date"] = str(last_payment[0].posting_date) if last_payment else ""

            # Open orders count
            open_orders = frappe.db.count("Sales Order", {
                "customer": cust, "docstatus": 1,
                "status": ["not in", ["Cancelled", "Closed", "Completed"]]
            })
            row["open_orders_count"] = cint(open_orders)

            # Open quotations count
            open_quotes = frappe.db.count("Quotation", {
                "customer": cust, "docstatus": 1, "status": "Open"
            })
            row["open_quotations_count"] = cint(open_quotes)

            # Sales rep name
            rep_name = frappe.db.get_value("User", row.get("owner"), "full_name")
            row["sales_rep_name"] = rep_name or row.get("owner", "")

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

        # Role-based permission check
        role_filter = get_role_filter()
        if role_filter:
            owner = frappe.db.get_value("Customer", customer, "owner")
            if owner != role_filter:
                return {"status": "error", "message": "Not permitted", "data": {}}

        cust_doc = frappe.db.get_value(
            "Customer", customer,
            ["name", "customer_name", "territory", "customer_group", "owner"],
            as_dict=True
        )

        # Sales Person
        sales_person = frappe.db.get_value(
            "Sales Team",
            {"parent": customer, "parenttype": "Customer"},
            "sales_person"
        )

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

        conditions = ["si.docstatus = 1", "si.outstanding_amount > 0"]
        values = {"today": today()}

        # Role-based filter
        if role_filter:
            conditions.append("si.owner = %(role_owner)s")
            values["role_owner"] = role_filter

        # Sales Person filter — check Sales Team child table
        if filters and filters.get("sales_person"):
            conditions.append("""EXISTS (
                SELECT 1 FROM `tabSales Team` st
                WHERE st.parent = si.name AND st.parenttype = 'Sales Invoice'
                AND st.sales_person = %(sales_person)s
            )""")
            values["sales_person"] = filters["sales_person"]

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

        # Get sales person for each invoice from Sales Team child
        for inv in invoices:
            sp = frappe.db.get_value(
                "Sales Team",
                {"parent": inv["name"], "parenttype": "Sales Invoice"},
                "sales_person"
            )
            inv["sales_person"] = sp or ""
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
            WHERE docstatus = 1 AND posting_date >= %(month_start)s
        """, {"month_start": month_start}, as_dict=True)[0]

        # YTD
        ytd = frappe.db.sql("""
            SELECT COALESCE(SUM(net_total), 0) as total
            FROM `tabSales Invoice`
            WHERE docstatus = 1 AND posting_date >= %(year_start)s
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
    """Return net sales by Sales Person for MTD and YTD (from Sales Invoice > Sales Team child)."""
    try:
        month_start = get_first_day(today())
        year_start = getdate(today()).replace(month=1, day=1)

        # MTD by Sales Person
        mtd_rows = frappe.db.sql("""
            SELECT
                COALESCE(st.sales_person, 'Unassigned') as sales_person,
                SUM(si.net_total * st.allocated_percentage / 100) as net_total
            FROM `tabSales Invoice` si
            LEFT JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
            WHERE si.docstatus = 1
              AND si.posting_date >= %(month_start)s
            GROUP BY st.sales_person
            ORDER BY net_total DESC
        """, {"month_start": month_start}, as_dict=True)

        # YTD by Sales Person
        ytd_rows = frappe.db.sql("""
            SELECT
                COALESCE(st.sales_person, 'Unassigned') as sales_person,
                SUM(si.net_total * st.allocated_percentage / 100) as net_total
            FROM `tabSales Invoice` si
            LEFT JOIN `tabSales Team` st ON st.parent = si.name AND st.parenttype = 'Sales Invoice'
            WHERE si.docstatus = 1
              AND si.posting_date >= %(year_start)s
            GROUP BY st.sales_person
            ORDER BY net_total DESC
        """, {"year_start": year_start}, as_dict=True)

        for row in mtd_rows:
            row["net_total"] = flt(row.get("net_total"))
        for row in ytd_rows:
            row["net_total"] = flt(row.get("net_total"))

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
