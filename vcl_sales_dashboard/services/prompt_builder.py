import json

# Controlled enum values — single source of truth
ALLOWED_REPORT_TYPES = [
	"Visit Update",
	"Call Update",
	"Order Opportunity",
	"Quotation Follow-up",
	"Payment Follow-up",
	"Complaint",
	"Delivery Follow-up",
	"Relationship Visit",
	"No Opportunity",
	"Other",
]

ALLOWED_STATUSES = [
	"New Lead",
	"Visited",
	"Follow-up Required",
	"Quote Requested",
	"Quote Sent",
	"Awaiting Customer Feedback",
	"Awaiting PO",
	"Order Likely",
	"Order Confirmed",
	"Delivery Pending",
	"Delivered",
	"Payment Follow-up",
	"Complaint Open",
	"Closed No Opportunity",
	"Escalate to Management",
]

ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Critical"]

ALLOWED_SENTIMENTS = ["Positive", "Neutral", "Negative", "Mixed"]


def build_system_prompt():
	"""Build the system instruction for the OpenAI classification call."""
	return (
		"You are a sales report classifier for Vimit Converters Limited (VCL), "
		"a stationery and paper product manufacturer. "
		"Your job is to take raw free-text daily sales field notes written by sales reps "
		"and classify them into structured business data.\n\n"
		"CRITICAL RULES:\n"
		"1. Classify ONLY from the supplied text. Do not invent facts.\n"
		"2. Customer must be one of the supplied candidates or marked 'Unmatched'.\n"
		"3. Use ONLY the allowed enum values provided.\n"
		"4. If uncertain about any field, set needs_review=true and explain in review_notes.\n"
		"5. If the report mentions multiple customers or actions, split into multiple lines.\n"
		"6. Return ONLY the structured JSON output — no prose, no markdown.\n"
		"7. Dates should be in YYYY-MM-DD format.\n"
		"8. Confidence scores must be between 0.0 and 1.0.\n"
		"9. Preserve the original meaning — do not over-interpret vague statements.\n"
		"10. If a follow-up day name is given (e.g. 'Tuesday'), calculate the next occurrence "
		"from the report date provided."
	)


def build_user_prompt(raw_text, report_date, candidate_customers):
	"""Build the user message containing the report text and context."""
	customer_list_str = "None found — mark customer as Unmatched."
	if candidate_customers:
		entries = []
		for c in candidate_customers:
			entry = f"- {c['name']}: {c['customer_name']}"
			if c.get("territory"):
				entry += f" (Territory: {c['territory']})"
			entries.append(entry)
		customer_list_str = "\n".join(entries)

	return (
		f"Report Date: {report_date}\n\n"
		f"ALLOWED REPORT TYPES:\n{json.dumps(ALLOWED_REPORT_TYPES)}\n\n"
		f"ALLOWED STATUSES:\n{json.dumps(ALLOWED_STATUSES)}\n\n"
		f"ALLOWED PRIORITIES:\n{json.dumps(ALLOWED_PRIORITIES)}\n\n"
		f"ALLOWED SENTIMENTS:\n{json.dumps(ALLOWED_SENTIMENTS)}\n\n"
		f"CANDIDATE CUSTOMERS:\n{customer_list_str}\n\n"
		f"RAW SALES REPORT TEXT:\n{raw_text}"
	)


def get_response_schema():
	"""Return the JSON schema for OpenAI structured output."""
	line_schema = {
		"type": "object",
		"properties": {
			"raw_line_text": {"type": "string"},
			"raw_customer_text": {"type": "string"},
			"matched_customer_code": {"type": "string", "description": "ERPNext Customer name/ID from candidates, or empty if unmatched"},
			"matched_customer_name": {"type": "string"},
			"customer_match_type": {"type": "string", "enum": ["Exact", "Fuzzy", "Candidate Only", "Unmatched"]},
			"customer_match_score": {"type": "number"},
			"report_type": {"type": "string", "enum": ALLOWED_REPORT_TYPES},
			"status": {"type": "string", "enum": ALLOWED_STATUSES},
			"priority": {"type": "string", "enum": ALLOWED_PRIORITIES},
			"sentiment": {"type": "string", "enum": ALLOWED_SENTIMENTS},
			"action_required": {"type": "string"},
			"followup_date": {"type": "string", "description": "YYYY-MM-DD or empty string"},
			"order_value_text": {"type": "string"},
			"quantity_text": {"type": "string"},
			"product_reference_text": {"type": "string"},
			"confidence": {"type": "number"},
			"needs_review": {"type": "boolean"},
			"review_notes": {"type": "string"},
		},
		"required": [
			"raw_line_text", "raw_customer_text", "matched_customer_code",
			"matched_customer_name", "customer_match_type", "customer_match_score",
			"report_type", "status", "priority", "sentiment",
			"action_required", "followup_date", "order_value_text",
			"quantity_text", "product_reference_text",
			"confidence", "needs_review", "review_notes",
		],
		"additionalProperties": False,
	}

	return {
		"type": "object",
		"properties": {
			"primary_summary": {
				"type": "object",
				"properties": {
					"primary_customer_name_cleaned": {"type": "string"},
					"primary_customer_code": {"type": "string"},
					"primary_report_type": {"type": "string", "enum": ALLOWED_REPORT_TYPES},
					"primary_status": {"type": "string", "enum": ALLOWED_STATUSES},
					"primary_priority": {"type": "string", "enum": ALLOWED_PRIORITIES},
					"primary_action_required": {"type": "string"},
					"primary_followup_date": {"type": "string"},
					"primary_sentiment": {"type": "string", "enum": ALLOWED_SENTIMENTS},
					"manager_attention_required": {"type": "boolean"},
					"review_required": {"type": "boolean"},
					"avg_confidence": {"type": "number"},
				},
				"required": [
					"primary_customer_name_cleaned", "primary_customer_code",
					"primary_report_type", "primary_status", "primary_priority",
					"primary_action_required", "primary_followup_date",
					"primary_sentiment", "manager_attention_required",
					"review_required", "avg_confidence",
				],
				"additionalProperties": False,
			},
			"lines": {
				"type": "array",
				"items": line_schema,
			},
		},
		"required": ["primary_summary", "lines"],
		"additionalProperties": False,
	}
