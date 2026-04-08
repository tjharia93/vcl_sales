import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class AIDailySalesReport(Document):
	def validate(self):
		self.validate_raw_text()
		self.validate_review_status()

	def validate_raw_text(self):
		if not (self.raw_report_text or "").strip():
			frappe.throw(_("Raw Report Text cannot be empty."))

	def validate_review_status(self):
		if self.review_status == "Approved" and not self.reviewed_by:
			self.reviewed_by = frappe.session.user
			self.reviewed_on = now_datetime()

	def before_submit(self):
		if self.ai_processing_status not in ("Processed", "Needs Review"):
			frappe.throw(
				_("Cannot submit a report that has not been classified. "
				  "Current AI status: {0}").format(self.ai_processing_status)
			)
		if self.review_required and self.review_status not in ("Approved", "Reviewed"):
			frappe.throw(
				_("This report requires review before submission. "
				  "Please review and approve first.")
			)

	def on_update(self):
		if self.review_status in ("Approved", "Reviewed") and not self.reviewed_by:
			frappe.db.set_value(
				self.doctype, self.name,
				{"reviewed_by": frappe.session.user, "reviewed_on": now_datetime()},
				update_modified=False,
			)
