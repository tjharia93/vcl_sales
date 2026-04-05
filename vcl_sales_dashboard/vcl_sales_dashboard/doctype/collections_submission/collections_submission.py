import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, getdate


MONTH_NAMES = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]


class CollectionsSubmission(Document):
    def before_insert(self):
        if not self.submitted_on:
            self.submitted_on = now_datetime()

    def validate(self):
        self.derive_submission_label()

    def derive_submission_label(self):
        if self.period_end:
            d = getdate(self.period_end)
            self.submission_label = f"{MONTH_NAMES[d.month]} {d.year}"
