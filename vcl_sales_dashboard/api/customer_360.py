import frappe
from frappe.utils import today, getdate, flt, cint
from vcl_sales_dashboard.api.sales_dashboard import get_csr_map


def get_role_filter():
    """Returns user email for Sales Rep filtering, or None for managers."""
    user = frappe.session.user
    roles = frappe.get_roles(user)
    if any(r in roles for r in ["Sales Manager", "Finance Manager", "System Manager"]):
        return None
    return user


def check_customer_access(customer):
    """Check if the current user has permission to view this customer via CSR Assignment."""
    if not frappe.db.exists("Customer", customer):
        frappe.throw("Customer not found", frappe.DoesNotExistError)

    role_filter = get_role_filter()
    if role_filter:
        csr_map = get_csr_map()
        assigned_rep = csr_map.get(customer, "")
        if assigned_rep != role_filter:
            frappe.throw("Not permitted", frappe.PermissionError)


@frappe.whitelist()
def get_customer_open_documents(customer):
    """Return combined list of open Quotations, Sales Orders, and Delivery Notes for a customer."""
    try:
        if not customer:
            return {"status": "error", "message": "Customer is required", "data": []}

        check_customer_access(customer)
        documents = []

        # Open Quotations
        quotations = frappe.db.sql("""
            SELECT
                'Quotation' as doctype,
                name, transaction_date as date,
                grand_total, status
            FROM `tabQuotation`
            WHERE customer = %(cust)s AND docstatus = 1 AND status = 'Open'
            ORDER BY transaction_date DESC
        """, {"cust": customer}, as_dict=True)
        documents.extend(quotations)

        # Open Sales Orders
        orders = frappe.db.sql("""
            SELECT
                'Sales Order' as doctype,
                name, transaction_date as date,
                grand_total, status
            FROM `tabSales Order`
            WHERE customer = %(cust)s AND docstatus = 1
              AND status NOT IN ('Cancelled', 'Closed', 'Completed')
            ORDER BY transaction_date DESC
        """, {"cust": customer}, as_dict=True)
        documents.extend(orders)

        # Delivery Notes not fully billed
        delivery_notes = frappe.db.sql("""
            SELECT
                'Delivery Note' as doctype,
                name, posting_date as date,
                grand_total, status
            FROM `tabDelivery Note`
            WHERE customer = %(cust)s AND docstatus = 1
              AND status != 'Closed' AND per_billed < 100
            ORDER BY posting_date DESC
        """, {"cust": customer}, as_dict=True)
        documents.extend(delivery_notes)

        # Sort combined list by date descending
        documents.sort(key=lambda x: str(x.get("date", "")), reverse=True)

        # N/A-safe
        for row in documents:
            row["grand_total"] = flt(row.get("grand_total"))
            if not row.get("date"):
                row["date"] = ""
            if not row.get("status"):
                row["status"] = ""

        return {"status": "ok", "data": documents}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except frappe.DoesNotExistError:
        return {"status": "error", "message": "Customer not found", "data": []}
    except Exception as e:
        frappe.log_error(f"get_customer_open_documents error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_customer_collections_ageing(customer):
    """Return ageing buckets for a single customer's outstanding invoices."""
    try:
        if not customer:
            return {"status": "error", "message": "Customer is required", "data": {}}

        check_customer_access(customer)

        result = frappe.db.sql("""
            SELECT
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 0 AND 30
                    THEN outstanding_amount ELSE 0 END) as bucket_0_30_value,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 0 AND 30
                    THEN 1 ELSE 0 END) as bucket_0_30_count,

                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60
                    THEN outstanding_amount ELSE 0 END) as bucket_31_60_value,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60
                    THEN 1 ELSE 0 END) as bucket_31_60_count,

                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90
                    THEN outstanding_amount ELSE 0 END) as bucket_61_90_value,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90
                    THEN 1 ELSE 0 END) as bucket_61_90_count,

                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90
                    THEN outstanding_amount ELSE 0 END) as bucket_90_plus_value,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90
                    THEN 1 ELSE 0 END) as bucket_90_plus_count
            FROM `tabSales Invoice`
            WHERE customer = %(cust)s AND docstatus = 1
              AND outstanding_amount > 0 AND due_date < CURDATE()
        """, {"cust": customer}, as_dict=True)

        row = result[0] if result else {}

        data = {
            "bucket_0_30": {
                "value": flt(row.get("bucket_0_30_value")),
                "count": cint(row.get("bucket_0_30_count"))
            },
            "bucket_31_60": {
                "value": flt(row.get("bucket_31_60_value")),
                "count": cint(row.get("bucket_31_60_count"))
            },
            "bucket_61_90": {
                "value": flt(row.get("bucket_61_90_value")),
                "count": cint(row.get("bucket_61_90_count"))
            },
            "bucket_90_plus": {
                "value": flt(row.get("bucket_90_plus_value")),
                "count": cint(row.get("bucket_90_plus_count"))
            }
        }

        return {"status": "ok", "data": data}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": {}}
    except frappe.DoesNotExistError:
        return {"status": "error", "message": "Customer not found", "data": {}}
    except Exception as e:
        frappe.log_error(f"get_customer_collections_ageing error: {str(e)}")
        return {"status": "error", "message": str(e), "data": {}}


@frappe.whitelist()
def get_customer_recent_invoices(customer):
    """Return last 12 invoices for a customer with overdue status."""
    try:
        if not customer:
            return {"status": "error", "message": "Customer is required", "data": []}

        check_customer_access(customer)

        invoices = frappe.db.sql("""
            SELECT
                name, posting_date, grand_total,
                outstanding_amount, due_date, status,
                CASE
                    WHEN outstanding_amount > 0 AND due_date < CURDATE() THEN 1
                    ELSE 0
                END as is_overdue
            FROM `tabSales Invoice`
            WHERE customer = %(cust)s AND docstatus = 1
            ORDER BY posting_date DESC
            LIMIT 12
        """, {"cust": customer}, as_dict=True)

        # N/A-safe
        for row in invoices:
            row["grand_total"] = flt(row.get("grand_total"))
            row["outstanding_amount"] = flt(row.get("outstanding_amount"))
            if not row.get("posting_date"):
                row["posting_date"] = ""
            if not row.get("due_date"):
                row["due_date"] = ""
            if not row.get("status"):
                row["status"] = ""

        return {"status": "ok", "data": invoices}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except frappe.DoesNotExistError:
        return {"status": "error", "message": "Customer not found", "data": []}
    except Exception as e:
        frappe.log_error(f"get_customer_recent_invoices error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}


@frappe.whitelist()
def get_customer_recent_payments(customer):
    """Return last 12 payments received from a customer."""
    try:
        if not customer:
            return {"status": "error", "message": "Customer is required", "data": []}

        check_customer_access(customer)

        payments = frappe.db.sql("""
            SELECT
                name, posting_date, paid_amount,
                mode_of_payment, reference_no, remarks
            FROM `tabPayment Entry`
            WHERE party = %(cust)s
              AND payment_type = 'Receive'
              AND docstatus = 1
            ORDER BY posting_date DESC
            LIMIT 12
        """, {"cust": customer}, as_dict=True)

        # N/A-safe
        for row in payments:
            row["paid_amount"] = flt(row.get("paid_amount"))
            if not row.get("posting_date"):
                row["posting_date"] = ""
            if not row.get("mode_of_payment"):
                row["mode_of_payment"] = ""
            if not row.get("reference_no"):
                row["reference_no"] = ""
            if not row.get("remarks"):
                row["remarks"] = ""

        return {"status": "ok", "data": payments}
    except frappe.PermissionError:
        return {"status": "error", "message": "Not permitted", "data": []}
    except frappe.DoesNotExistError:
        return {"status": "error", "message": "Customer not found", "data": []}
    except Exception as e:
        frappe.log_error(f"get_customer_recent_payments error: {str(e)}")
        return {"status": "error", "message": str(e), "data": []}
