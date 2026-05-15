import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


VAT_RATE = 0.16


class VCLCreditNoteRequest(Document):
    def validate(self):
        self.recompute_line_amounts()
        self.recompute_totals()
        self.sync_cn_number()

    def recompute_line_amounts(self):
        for row in self.line_items or []:
            row.supplied_amount = flt(row.supplied_qty) * flt(row.supplied_unit_price)
            row.correct_amount = flt(row.correct_qty) * flt(row.correct_unit_price)
            row.difference = flt(row.supplied_amount) - flt(row.correct_amount)

    def recompute_totals(self):
        supplied = sum(flt(r.supplied_amount) for r in self.line_items or [])
        correct = sum(flt(r.correct_amount) for r in self.line_items or [])
        diff = supplied - correct
        self.subtotal_supplied = supplied
        self.subtotal_correct = correct
        self.vat_amount = diff * VAT_RATE
        self.total_credit = diff + self.vat_amount

    def sync_cn_number(self):
        if self.name and self.cn_number != self.name:
            self.cn_number = self.name

    def on_submit(self):
        if self.status == "Draft":
            self.db_set("status", "Pending Sales Manager", update_modified=False)

    def on_cancel(self):
        self.db_set("status", "Rejected", update_modified=False)


@frappe.whitelist()
def create_credit_note(cn_request: str) -> dict:
    """Create an ERPNext Sales Invoice (Is Return = 1) from an Approved CN Request.

    Returns dict with name and route of the new Sales Invoice.
    """
    doc = frappe.get_doc("VCL Credit Note Request", cn_request)

    if doc.status != "Approved":
        frappe.throw(_("CN Request must be Approved before creating the Credit Note."))

    if doc.linked_credit_note:
        frappe.throw(
            _("Credit Note {0} already exists for this request.").format(doc.linked_credit_note)
        )

    if not doc.original_invoice_no:
        frappe.throw(_("Original Invoice No. is required to create the Credit Note."))

    if not doc.line_items:
        frappe.throw(_("Line Items are required."))

    si = frappe.new_doc("Sales Invoice")
    si.customer = doc.customer
    si.is_return = 1
    si.return_against = doc.original_invoice_no
    si.set("vcl_cn_request", doc.name)

    # Pull company / currency from source invoice for a clean carry-over
    source = frappe.get_doc("Sales Invoice", doc.original_invoice_no)
    si.company = source.company
    si.currency = source.currency
    si.posting_date = frappe.utils.nowdate()

    # Map line items: credit = (supplied - correct) at the original supplied price.
    # Quantities are entered as negative on Is Return invoices.
    for row in doc.line_items:
        qty_diff = flt(row.supplied_qty) - flt(row.correct_qty)
        if not qty_diff:
            continue
        si.append(
            "items",
            {
                "item_name": row.description,
                "description": row.description,
                "qty": -abs(qty_diff),
                "uom": row.supplied_uom,
                "rate": flt(row.supplied_unit_price),
            },
        )

    si.insert(ignore_permissions=True)

    doc.db_set("linked_credit_note", si.name, update_modified=False)

    return {
        "name": si.name,
        "route": f"/app/sales-invoice/{si.name}",
    }
