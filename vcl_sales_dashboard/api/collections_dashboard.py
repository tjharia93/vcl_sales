import frappe
import json
from frappe.utils import flt, cint, now_datetime, getdate
from vcl_sales_dashboard.api.collections_utils import get_collections_role_filter


@frappe.whitelist()
def get_collections_summary(period_end=None, sales_rep=None):
    """Return KPI summary for the collections dashboard."""
    try:
        role_filter = get_collections_role_filter()

        conditions = []
        values = {}

        if period_end:
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = period_end
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter
        elif sales_rep:
            conditions.append("cs.assigned_sales_representative = %(sales_rep)s")
            values["sales_rep"] = sales_rep

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        result = frappe.db.sql(f"""
            SELECT
                COUNT(*) as total_customers,
                SUM(cs.total_balance) as total_balance,
                SUM(cs.overdue_amount) as total_overdue,
                SUM(cs.overdue_30_amount) as total_overdue_30,
                SUM(cs.due_current_month) as total_due_current_month,
                SUM(cs.due_next_month) as total_due_next_month,
                SUM(cs.pd_cheques_cm) as total_pd_cheques_cm,
                SUM(CASE WHEN cs.latest_follow_up_status = 'Not Contacted' THEN 1 ELSE 0 END) as not_contacted,
                SUM(CASE WHEN cs.latest_follow_up_status = 'Promise to Pay' THEN 1 ELSE 0 END) as promise_to_pay,
                SUM(CASE WHEN cs.latest_follow_up_status = 'In Dispute' THEN 1 ELSE 0 END) as in_dispute,
                SUM(CASE WHEN cs.is_escalated = 1 THEN 1 ELSE 0 END) as escalated,
                SUM(CASE WHEN cs.is_priority = 1 THEN 1 ELSE 0 END) as priority_count
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
                AND sub.status = 'Processed'
            {where}
        """, values, as_dict=True)

        return {"status": "ok", "data": result[0] if result else {}}

    except Exception as e:
        frappe.log_error(f"Collections summary error: {e}")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_collections_rep_summary(period_end=None):
    """Return collections summary grouped by sales rep."""
    try:
        role_filter = get_collections_role_filter()

        conditions = ["sub.status = 'Processed'"]
        values = {}

        if period_end:
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = period_end
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter

        where = "WHERE " + " AND ".join(conditions)

        result = frappe.db.sql(f"""
            SELECT
                COALESCE(cs.assigned_sales_representative, 'Unassigned') as sales_rep,
                cs.sales_rep_user,
                COUNT(*) as customer_count,
                SUM(cs.total_balance) as total_balance,
                SUM(cs.overdue_amount) as total_overdue,
                SUM(cs.overdue_30_amount) as total_overdue_30,
                SUM(cs.due_current_month) as due_current_month,
                SUM(CASE WHEN cs.latest_follow_up_status = 'Not Contacted' THEN 1 ELSE 0 END) as not_contacted
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
            GROUP BY cs.assigned_sales_representative, cs.sales_rep_user
            ORDER BY total_overdue DESC
        """, values, as_dict=True)

        return {"status": "ok", "data": result}

    except Exception as e:
        frappe.log_error(f"Collections rep summary error: {e}")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_collections_customer_list(filters=None):
    """Return the filtered customer list for the collections dashboard."""
    try:
        if isinstance(filters, str):
            filters = json.loads(filters)
        filters = filters or {}

        role_filter = get_collections_role_filter()

        conditions = ["sub.status = 'Processed'"]
        values = {}

        if filters.get("period_end"):
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = filters["period_end"]
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter
        elif filters.get("sales_rep"):
            conditions.append("cs.assigned_sales_representative = %(sales_rep)s")
            values["sales_rep"] = filters["sales_rep"]
        if filters.get("status"):
            conditions.append("cs.latest_follow_up_status = %(status)s")
            values["status"] = filters["status"]
        if filters.get("overdue_only"):
            conditions.append("cs.overdue_amount > 0")
        if filters.get("overdue_30_only"):
            conditions.append("cs.overdue_30_amount > 0")
        if filters.get("priority_only"):
            conditions.append("cs.is_priority = 1")
        if filters.get("no_comment_only"):
            conditions.append("cs.latest_follow_up_status = 'Not Contacted'")
        if filters.get("search_text"):
            conditions.append(
                "(cs.excel_customer_name LIKE %(search)s OR cs.customer_name_display LIKE %(search)s)"
            )
            values["search"] = f"%{filters['search_text']}%"

        where = "WHERE " + " AND ".join(conditions)

        limit = cint(filters.get("limit")) or 100
        offset = cint(filters.get("offset")) or 0

        result = frappe.db.sql(f"""
            SELECT
                cs.name, cs.collections_submission,
                cs.excel_customer_name, cs.customer, cs.customer_name_display,
                cs.customer_match_status,
                cs.assigned_sales_representative, cs.sales_rep_user,
                cs.assignment_match_status,
                cs.terms,
                cs.total_balance, cs.overdue_amount, cs.overdue_30_amount,
                cs.due_current_month, cs.due_next_month, cs.pd_cheques_cm,
                cs.latest_follow_up_status, cs.latest_comment_date,
                cs.promised_payment_date, cs.expected_collection_amount,
                cs.next_action_date, cs.is_priority, cs.is_escalated,
                cs.period_end
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
            ORDER BY cs.overdue_amount DESC
            LIMIT %(limit)s OFFSET %(offset)s
        """, {**values, "limit": limit, "offset": offset}, as_dict=True)

        count = frappe.db.sql(f"""
            SELECT COUNT(*) as cnt
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
        """, values, as_dict=True)

        return {
            "status": "ok",
            "data": result,
            "total": count[0].cnt if count else 0,
        }

    except Exception as e:
        frappe.log_error(f"Collections customer list error: {e}")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_customer_snapshot_detail(snapshot_name):
    """Return full detail for a single snapshot row."""
    try:
        doc = frappe.get_doc("Collections Customer Snapshot", snapshot_name)

        role_filter = get_collections_role_filter()
        if role_filter and doc.sales_rep_user != role_filter:
            frappe.throw("Not permitted", frappe.PermissionError)

        return {"status": "ok", "data": doc.as_dict()}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_customer_month_history(customer=None, excel_customer_name=None):
    """Return month-over-month snapshots for a customer."""
    try:
        conditions = ["sub.status = 'Processed'"]
        values = {}

        if customer:
            conditions.append("cs.customer = %(customer)s")
            values["customer"] = customer
        elif excel_customer_name:
            conditions.append("cs.excel_customer_name = %(excel_name)s")
            values["excel_name"] = excel_customer_name
        else:
            return {"status": "error", "message": "Provide customer or excel_customer_name."}

        role_filter = get_collections_role_filter()
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter

        where = "WHERE " + " AND ".join(conditions)

        result = frappe.db.sql(f"""
            SELECT
                cs.name, cs.period_end, cs.snapshot_label,
                cs.total_balance, cs.overdue_amount, cs.overdue_30_amount,
                cs.due_current_month, cs.latest_follow_up_status
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
            ORDER BY cs.period_end DESC
        """, values, as_dict=True)

        return {"status": "ok", "data": result}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def add_follow_up(snapshot_name, payload=None):
    """Add a follow-up comment to a snapshot."""
    try:
        if isinstance(payload, str):
            payload = json.loads(payload)
        payload = payload or {}

        snapshot = frappe.get_doc("Collections Customer Snapshot", snapshot_name)

        role_filter = get_collections_role_filter()
        if role_filter and snapshot.sales_rep_user != role_filter:
            frappe.throw("Not permitted", frappe.PermissionError)

        follow_up = frappe.new_doc("Collections Follow Up")
        follow_up.collections_customer_snapshot = snapshot_name
        follow_up.collections_submission = snapshot.collections_submission
        follow_up.customer = snapshot.customer
        follow_up.comment_date = now_datetime()
        follow_up.comment_by = frappe.session.user
        follow_up.comment_type = payload.get("comment_type", "Internal Note")
        follow_up.follow_up_status = payload.get("follow_up_status", "Contacted")
        follow_up.comment_text = payload.get("comment_text", "")
        follow_up.promised_payment_date = payload.get("promised_payment_date")
        follow_up.expected_collection_amount = payload.get("expected_collection_amount")
        follow_up.priority = payload.get("priority")
        follow_up.next_action_date = payload.get("next_action_date")
        follow_up.escalation_needed = cint(payload.get("escalation_needed"))

        follow_up.insert(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "ok",
            "message": "Follow-up added.",
            "name": follow_up.name,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_follow_ups(snapshot_name):
    """Return all follow-ups for a snapshot."""
    try:
        snapshot = frappe.get_doc("Collections Customer Snapshot", snapshot_name)

        role_filter = get_collections_role_filter()
        if role_filter and snapshot.sales_rep_user != role_filter:
            frappe.throw("Not permitted", frappe.PermissionError)

        result = frappe.get_all(
            "Collections Follow Up",
            filters={"collections_customer_snapshot": snapshot_name},
            fields=[
                "name", "comment_date", "comment_by", "comment_type",
                "follow_up_status", "comment_text", "promised_payment_date",
                "expected_collection_amount", "priority", "next_action_date",
                "escalation_needed",
            ],
            order_by="comment_date desc",
        )

        return {"status": "ok", "data": result}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_available_periods():
    """Return list of available submission periods for filter dropdowns."""
    try:
        result = frappe.db.sql("""
            SELECT DISTINCT period_end, submission_label
            FROM `tabCollections Submission`
            WHERE status = 'Processed'
            ORDER BY period_end DESC
        """, as_dict=True)

        return {"status": "ok", "data": result}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_terms_diagnostics(period_end=None):
    """Diagnostic: show terms resolution stats for the selected period."""
    try:
        conditions = ["sub.status = 'Processed'"]
        values = {}
        if period_end:
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = period_end
        where = "WHERE " + " AND ".join(conditions)

        result = frappe.db.sql(f"""
            SELECT
                cs.terms_match_status,
                cs.credit_days,
                COUNT(*) as cnt,
                cs.terms_from_file as sample_file_terms,
                cs.credit_terms_from_customer as sample_erp_terms,
                cs.terms_used_for_calculation as sample_used
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
            GROUP BY cs.terms_match_status, cs.credit_days, cs.terms_from_file,
                     cs.credit_terms_from_customer, cs.terms_used_for_calculation
            ORDER BY cnt DESC
            LIMIT 20
        """, values, as_dict=True)

        return {"status": "ok", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_sales_rep_options(period_end=None):
    """Return distinct assigned_sales_representative values from snapshot data."""
    try:
        conditions = ["sub.status = 'Processed'"]
        values = {}
        if period_end:
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = period_end
        where = "WHERE " + " AND ".join(conditions)

        result = frappe.db.sql(f"""
            SELECT DISTINCT cs.assigned_sales_representative as name
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
              AND cs.assigned_sales_representative IS NOT NULL
              AND cs.assigned_sales_representative != ''
            ORDER BY cs.assigned_sales_representative ASC
        """, values, as_dict=True)

        return {"status": "ok", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Warning / Review Queues ──────────────────────────────────────────

@frappe.whitelist()
def get_warning_queues(period_end=None, sales_rep=None):
    """Return warning/review queue counts and rows for the selected period."""
    try:
        role_filter = get_collections_role_filter()

        conditions = ["sub.status = 'Processed'"]
        values = {}

        if period_end:
            conditions.append("cs.period_end = %(period_end)s")
            values["period_end"] = period_end
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter
        elif sales_rep:
            conditions.append("cs.assigned_sales_representative = %(sales_rep)s")
            values["sales_rep"] = sales_rep

        where = "WHERE " + " AND ".join(conditions)

        base_fields = """
            cs.name, cs.excel_customer_name, cs.customer, cs.customer_name_display,
            cs.assigned_sales_representative, cs.customer_match_status,
            cs.assignment_match_status, cs.total_balance, cs.overdue_amount,
            cs.latest_follow_up_status, cs.promised_payment_date,
            cs.is_escalated, cs.is_priority
        """

        queues = {}

        queues["customer_not_matched"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where} AND cs.customer_match_status = 'Customer Not Matched'
            ORDER BY cs.total_balance DESC
        """, values, as_dict=True)

        queues["no_rep_assignment"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where} AND cs.assignment_match_status = 'No Valid Assignment For Period'
            ORDER BY cs.overdue_amount DESC
        """, values, as_dict=True)

        queues["multiple_assignments"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where} AND cs.assignment_match_status = 'Multiple Assignments Found'
            ORDER BY cs.overdue_amount DESC
        """, values, as_dict=True)

        queues["promise_to_pay_due"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
              AND cs.latest_follow_up_status = 'Promise to Pay'
              AND cs.promised_payment_date IS NOT NULL
              AND cs.promised_payment_date <= CURDATE()
            ORDER BY cs.promised_payment_date ASC
        """, values, as_dict=True)

        queues["escalated"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where} AND cs.is_escalated = 1
            ORDER BY cs.overdue_amount DESC
        """, values, as_dict=True)

        queues["in_dispute"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where} AND cs.latest_follow_up_status = 'In Dispute'
            ORDER BY cs.overdue_amount DESC
        """, values, as_dict=True)

        queues["no_comment_overdue"] = frappe.db.sql(f"""
            SELECT {base_fields}
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
              AND cs.latest_follow_up_status = 'Not Contacted'
              AND cs.overdue_amount > 0
            ORDER BY cs.overdue_amount DESC
            LIMIT 50
        """, values, as_dict=True)

        summary = {k: len(v) for k, v in queues.items()}

        return {"status": "ok", "summary": summary, "queues": queues}

    except Exception as e:
        frappe.log_error(f"Warning queues error: {e}")
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def get_customer_month_trend(customer=None, excel_customer_name=None):
    """Return month-over-month trend data for a customer."""
    try:
        conditions = ["sub.status = 'Processed'"]
        values = {}

        if customer:
            conditions.append("cs.customer = %(customer)s")
            values["customer"] = customer
        elif excel_customer_name:
            conditions.append("cs.excel_customer_name = %(excel_name)s")
            values["excel_name"] = excel_customer_name
        else:
            return {"status": "error", "message": "Provide customer or excel_customer_name."}

        role_filter = get_collections_role_filter()
        if role_filter:
            conditions.append("cs.sales_rep_user = %(role_filter)s")
            values["role_filter"] = role_filter

        where = "WHERE " + " AND ".join(conditions)

        result = frappe.db.sql(f"""
            SELECT
                cs.name, cs.period_end,
                cs.snapshot_label,
                cs.total_balance, cs.overdue_amount, cs.overdue_30_amount,
                cs.due_current_month, cs.due_next_month,
                cs.bucket_current, cs.bucket_1_15, cs.bucket_16_30,
                cs.bucket_31_45, cs.bucket_46_60, cs.bucket_61_75,
                cs.bucket_76_90, cs.bucket_91_105, cs.bucket_106_120,
                cs.bucket_121_135, cs.bucket_136_150, cs.bucket_151_165,
                cs.bucket_166_180, cs.bucket_181_over,
                cs.latest_follow_up_status, cs.pd_cheques_cm
            FROM `tabCollections Customer Snapshot` cs
            INNER JOIN `tabCollections Submission` sub ON cs.collections_submission = sub.name
            {where}
            ORDER BY cs.period_end ASC
        """, values, as_dict=True)

        trend = []
        for i, row in enumerate(result):
            entry = dict(row)
            if i > 0:
                prev = result[i - 1]
                entry["balance_change"] = flt(row.total_balance) - flt(prev.total_balance)
                entry["overdue_change"] = flt(row.overdue_amount) - flt(prev.overdue_amount)
            else:
                entry["balance_change"] = 0
                entry["overdue_change"] = 0
            trend.append(entry)

        return {"status": "ok", "data": trend}

    except Exception as e:
        return {"status": "error", "message": str(e)}
