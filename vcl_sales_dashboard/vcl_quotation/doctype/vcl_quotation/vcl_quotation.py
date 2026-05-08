import frappe
from frappe.model.document import Document


class VCLQuotation(Document):
    def before_save(self):
        if self.name and self.quote_ref != self.name:
            self.quote_ref = self.name

    def autoname(self):
        super().autoname()
        if self.name:
            self.quote_ref = self.name
