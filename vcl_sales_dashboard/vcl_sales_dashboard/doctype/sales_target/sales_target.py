import frappe
from frappe.model.document import Document
from frappe.utils import getdate


class SalesTarget(Document):
    def validate(self):
        if self.period_month:
            d = getdate(self.period_month)
            self.period_key = f"{d.year}-{d.month:02d}"
