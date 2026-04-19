import frappe
from frappe.utils import getdate

from vcl_sales_dashboard.services.prompt_builder import (
	ALLOWED_PRIORITIES,
	ALLOWED_REPORT_TYPES,
	ALLOWED_SENTIMENTS,
	ALLOWED_STATUSES,
)
from vcl_sales_dashboard.services.customer_matching import resolve_customer_link


def validate_and_apply(doc, ai_result, settings):
	"""Validate the parsed AI response and write it into the document fields.

	Args:
		doc: The AI Daily Sales Report document
		ai_result: The parsed dict from OpenAI (primary_summary + lines)
		settings: The Sales AI Settings singleton

	Returns:
		dict with validation info
	"""
	errors = []
	primary = ai_result.get("primary_summary", {})
	lines = ai_result.get("lines", [])

	# --- Validate and apply primary summary ---
	doc.primary_customer_name_cleaned = _safe_str(primary.get("primary_customer_name_cleaned"))
	doc.primary_report_type = _validate_enum(
		primary.get("primary_report_type"), ALLOWED_REPORT_TYPES, "primary_report_type", errors
	)
	doc.primary_status = _validate_enum(
		primary.get("primary_status"), ALLOWED_STATUSES, "primary_status", errors
	)
	doc.primary_priority = _validate_enum(
		primary.get("primary_priority"), ALLOWED_PRIORITIES, "primary_priority", errors
	)
	doc.primary_sentiment = _validate_enum(
		primary.get("primary_sentiment"), ALLOWED_SENTIMENTS, "primary_sentiment", errors
	)
	doc.primary_action_required = _safe_str(primary.get("primary_action_required"))
	doc.primary_followup_date = _validate_date(
		primary.get("primary_followup_date"), "primary_followup_date", errors
	)
	doc.manager_attention_required = 1 if primary.get("manager_attention_required") else 0
	doc.ai_confidence_avg = _validate_confidence(
		primary.get("avg_confidence"), "avg_confidence", errors
	)

	# Resolve primary customer link
	primary_customer_code = _safe_str(primary.get("primary_customer_code"))
	primary_customer_name = doc.primary_customer_name_cleaned
	resolved = resolve_customer_link(primary_customer_code, primary_customer_name)
	doc.primary_customer = resolved or ""

	# Determine review requirement
	review_required = primary.get("review_required", False)
	confidence_threshold = settings.default_review_required_below_confidence or 0.80
	if doc.ai_confidence_avg and doc.ai_confidence_avg < confidence_threshold:
		review_required = True
	if not resolved and primary_customer_code:
		review_required = True
	doc.review_required = 1 if review_required else 0

	# --- Validate and apply child lines ---
	doc.extracted_lines = []
	doc.contains_multiple_updates = 1 if len(lines) > 1 else 0

	customer_mentions = []

	for idx, line_data in enumerate(lines):
		line = _build_line_row(doc, line_data, idx, settings, errors)
		doc.append("extracted_lines", line)
		raw_cust = _safe_str(line_data.get("raw_customer_text"))
		if raw_cust:
			customer_mentions.append(raw_cust)

	doc.raw_customer_mentions = ", ".join(customer_mentions) if customer_mentions else ""

	# Mark primary line
	if doc.extracted_lines:
		doc.extracted_lines[0].is_primary_line = 1

	# Set processing status
	if errors:
		doc.ai_processing_status = "Failed"
		doc.ai_error_log = (doc.ai_error_log or "") + "\nValidation errors:\n" + "\n".join(errors)
	elif doc.review_required:
		doc.ai_processing_status = "Needs Review"
		doc.review_status = "Pending Review"
	else:
		doc.ai_processing_status = "Processed"

	return {
		"errors": errors,
		"line_count": len(lines),
		"review_required": bool(doc.review_required),
	}


def _build_line_row(doc, line_data, idx, settings, errors):
	"""Build a child table row dict from one line of the AI response."""
	prefix = f"line[{idx}]"
	row = {
		"raw_line_text": _safe_str(line_data.get("raw_line_text")),
		"raw_customer_text": _safe_str(line_data.get("raw_customer_text")),
		"matched_customer_name": _safe_str(line_data.get("matched_customer_name")),
		"customer_match_type": _validate_enum(
			line_data.get("customer_match_type"),
			["Exact", "Fuzzy", "Candidate Only", "Unmatched"],
			f"{prefix}.customer_match_type", errors,
		),
		"customer_match_score": _validate_confidence(
			line_data.get("customer_match_score"), f"{prefix}.customer_match_score", errors
		),
		"report_type": _validate_enum(
			line_data.get("report_type"), ALLOWED_REPORT_TYPES, f"{prefix}.report_type", errors
		),
		"status": _validate_enum(
			line_data.get("status"), ALLOWED_STATUSES, f"{prefix}.status", errors
		),
		"priority": _validate_enum(
			line_data.get("priority"), ALLOWED_PRIORITIES, f"{prefix}.priority", errors
		),
		"sentiment": _validate_enum(
			line_data.get("sentiment"), ALLOWED_SENTIMENTS, f"{prefix}.sentiment", errors
		),
		"action_required": _safe_str(line_data.get("action_required")),
		"followup_date": _validate_date(
			line_data.get("followup_date"), f"{prefix}.followup_date", errors
		),
		"order_value_text": _safe_str(line_data.get("order_value_text")),
		"quantity_text": _safe_str(line_data.get("quantity_text")),
		"product_reference_text": _safe_str(line_data.get("product_reference_text")),
		"confidence": _validate_confidence(
			line_data.get("confidence"), f"{prefix}.confidence", errors
		),
		"needs_review": 1 if line_data.get("needs_review") else 0,
		"review_notes": _safe_str(line_data.get("review_notes")),
		"is_primary_line": 0,
	}

	# Resolve customer link
	customer_code = _safe_str(line_data.get("matched_customer_code"))
	customer_name = row["matched_customer_name"]
	resolved = resolve_customer_link(customer_code, customer_name)

	threshold_high = settings.customer_match_threshold_high or 0.90
	threshold_low = settings.customer_match_threshold_low or 0.75
	score = row["customer_match_score"] or 0

	if resolved:
		row["matched_customer"] = resolved
		if score < threshold_high:
			row["needs_review"] = 1
	else:
		row["matched_customer"] = ""
		if customer_code or row["customer_match_type"] != "Unmatched":
			row["needs_review"] = 1
			if not row["review_notes"]:
				row["review_notes"] = "Customer could not be resolved in ERPNext."

		if score < threshold_low:
			row["customer_match_type"] = "Unmatched"

	return row


def _safe_str(val):
	if val is None:
		return ""
	return str(val).strip()


def _validate_enum(val, allowed, field_name, errors):
	val = _safe_str(val)
	if not val:
		return ""
	if val in allowed:
		return val
	errors.append(f"{field_name}: '{val}' is not an allowed value.")
	return ""


def _validate_date(val, field_name, errors):
	val = _safe_str(val)
	if not val:
		return None
	try:
		getdate(val)
		return val
	except Exception:
		errors.append(f"{field_name}: '{val}' is not a valid date.")
		return None


def _validate_confidence(val, field_name, errors):
	if val is None:
		return 0.0
	try:
		f = float(val)
		if f < 0 or f > 1:
			errors.append(f"{field_name}: confidence {f} not between 0 and 1.")
			return max(0.0, min(1.0, f))
		return f
	except (ValueError, TypeError):
		errors.append(f"{field_name}: '{val}' is not a valid number.")
		return 0.0
