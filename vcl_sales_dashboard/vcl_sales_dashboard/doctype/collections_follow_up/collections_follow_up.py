import frappe
from frappe.model.document import Document
from frappe.utils import flt


class CollectionsFollowUp(Document):
    def validate(self):
        self.validate_comment_text()
        self.validate_expected_amount()

    def after_insert(self):
        self.update_snapshot_state()

    def on_update(self):
        self.update_snapshot_state()

    def validate_comment_text(self):
        if not (self.comment_text or "").strip():
            frappe.throw("Comment text is required.")

    def validate_expected_amount(self):
        if self.expected_collection_amount and flt(self.expected_collection_amount) < 0:
            frappe.throw("Expected collection amount must be >= 0.")

    def update_snapshot_state(self):
        """Sync latest follow-up state back to the parent snapshot."""
        if not self.collections_customer_snapshot:
            return

        snapshot = frappe.get_doc("Collections Customer Snapshot", self.collections_customer_snapshot)
        snapshot.latest_follow_up_status = self.follow_up_status
        snapshot.latest_comment_date = self.comment_date
        snapshot.latest_comment_by = self.comment_by
        snapshot.promised_payment_date = self.promised_payment_date
        snapshot.expected_collection_amount = self.expected_collection_amount
        snapshot.next_action_date = self.next_action_date
        snapshot.is_escalated = 1 if self.escalation_needed else 0
        snapshot.is_priority = 1 if self.priority == "High" else 0
        snapshot.save(ignore_permissions=True)
