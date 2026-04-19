import frappe
from frappe import _
from frappe.model.document import Document


class SalesAISettings(Document):
	def validate(self):
		if self.enable_sales_ai and not self.get_password("openai_api_key"):
			frappe.throw(_("OpenAI API Key is required when Sales AI is enabled."))

		if self.customer_match_threshold_low >= self.customer_match_threshold_high:
			frappe.throw(
				_("Low Confidence Threshold must be less than High Confidence Threshold.")
			)
