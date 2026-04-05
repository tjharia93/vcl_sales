import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class CollectionsSubmission(Document):
    def before_insert(self):
        if not self.submitted_on:
            self.submitted_on = now_datetime()

    def validate(self):
        self.validate_period()

    def validate_period(self):
        if self.period_start and self.period_end:
            if self.period_start > self.period_end:
                frappe.throw("Period Start must be before or equal to Period End.")
