import frappe
from frappe.model.document import Document


class VCLQuotation(Document):
    # `frappe.model.document.Document` does not define `autoname()` — naming is
    # handled internally by `set_new_name`. The naming_series field on this
    # DocType (VCL-CQ-.YYYY.-.####) is enough to assign `self.name`. We just
    # mirror the assigned name into `quote_ref` after autoname has run.
    def before_save(self):
        if self.name and self.quote_ref != self.name:
            self.quote_ref = self.name
