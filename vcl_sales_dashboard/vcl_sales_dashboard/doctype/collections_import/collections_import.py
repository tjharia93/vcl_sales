import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class CollectionsImport(Document):
    def before_insert(self):
        if not self.upload_datetime:
            self.upload_datetime = now_datetime()

    def validate(self):
        self.validate_period()
        self.validate_file_type()

    def validate_period(self):
        if self.period_start and self.period_end:
            if self.period_start > self.period_end:
                frappe.throw("Period Start must be before or equal to Period End.")

    def validate_file_type(self):
        if self.source_file:
            allowed = (".xlsx", ".xls")
            if not self.source_file.lower().endswith(allowed):
                frappe.throw("Source file must be an Excel file (.xlsx or .xls).")
