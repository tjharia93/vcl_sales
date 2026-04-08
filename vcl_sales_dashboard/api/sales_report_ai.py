import json
import time

import frappe
from frappe import _
from frappe.utils import now_datetime


@frappe.whitelist()
def classify_sales_report(docname, force_reprocess=0):
	"""Main whitelisted method to classify a sales report using OpenAI.

	Called from the form button via frappe.call().
	"""
	force_reprocess = int(force_reprocess or 0)
	doc = frappe.get_doc("AI Daily Sales Report", docname)

	# --- Pre-flight validation ---
	_validate_before_classify(doc, force_reprocess)

	# --- Load settings ---
	settings = frappe.get_single("Sales AI Settings")
	if not settings.enable_sales_ai:
		frappe.throw(_("Sales AI is disabled. Enable it in Sales AI Settings."))

	# --- Mark as processing ---
	doc.ai_processing_status = "Processing"
	doc.processing_attempts = (doc.processing_attempts or 0) + 1
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	start_time = time.time()

	try:
		result = _run_classification(doc, settings)
	except Exception as e:
		elapsed_ms = int((time.time() - start_time) * 1000)
		doc.reload()
		doc.ai_processing_status = "Failed"
		doc.ai_error_log = (doc.ai_error_log or "") + f"\n[{now_datetime()}] {str(e)}"
		doc.last_processing_duration_ms = elapsed_ms
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		frappe.throw(_("Classification failed: {0}").format(str(e)))

	elapsed_ms = int((time.time() - start_time) * 1000)
	doc.last_processing_duration_ms = elapsed_ms
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	return {
		"success": True,
		"docname": doc.name,
		"processing_status": doc.ai_processing_status,
		"review_required": bool(doc.review_required),
		"primary_customer": doc.primary_customer or "",
		"line_count": len(doc.extracted_lines),
		"duration_ms": elapsed_ms,
		"message": _build_result_message(doc),
	}


@frappe.whitelist()
def approve_ai_report(docname):
	"""Mark a classified report as approved by the current user."""
	doc = frappe.get_doc("AI Daily Sales Report", docname)

	if doc.ai_processing_status not in ("Processed", "Needs Review"):
		frappe.throw(_("Only processed reports can be approved."))

	doc.review_status = "Approved"
	doc.reviewed_by = frappe.session.user
	doc.reviewed_on = now_datetime()
	doc.review_required = 0
	doc.ai_processing_status = "Processed"
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	return {"success": True, "message": _("Report approved by {0}.").format(frappe.session.user)}


@frappe.whitelist()
def get_customer_candidates(docname):
	"""Return candidate customers for a given report's raw text."""
	doc = frappe.get_doc("AI Daily Sales Report", docname)
	settings = frappe.get_single("Sales AI Settings")
	max_candidates = settings.max_candidate_customers or 20

	from vcl_sales_dashboard.services.customer_matching import get_customer_candidates as _get_candidates
	candidates = _get_candidates(doc.raw_report_text, max_candidates)
	return candidates


def _validate_before_classify(doc, force_reprocess):
	"""Pre-flight checks before calling OpenAI."""
	if not (doc.raw_report_text or "").strip():
		frappe.throw(_("Raw Report Text is empty. Nothing to classify."))

	if doc.docstatus == 1:
		frappe.throw(_("Cannot reclassify a submitted report. Amend it first."))

	if doc.ai_processing_status == "Processing":
		frappe.throw(_("This report is already being processed. Please wait."))

	if doc.ai_processing_status in ("Processed", "Needs Review") and not force_reprocess:
		frappe.throw(
			_("This report has already been classified. Use 'Rerun AI' to force reprocessing.")
		)

	# Warn if reviewed data exists and force reprocessing
	if force_reprocess and doc.review_status in ("Approved", "Reviewed"):
		frappe.msgprint(
			_("Warning: Reprocessing will overwrite previously reviewed data."),
			alert=True,
		)


def _run_classification(doc, settings):
	"""Execute the full classification pipeline."""
	from vcl_sales_dashboard.services.customer_matching import get_customer_candidates as _get_candidates
	from vcl_sales_dashboard.services.prompt_builder import (
		build_system_prompt,
		build_user_prompt,
		get_response_schema,
	)
	from vcl_sales_dashboard.services.openai_client import call_openai_structured
	from vcl_sales_dashboard.services.response_parser import validate_and_apply

	max_candidates = settings.max_candidate_customers or 20

	# Step 1: Get candidate customers
	candidates = _get_candidates(doc.raw_report_text, max_candidates)

	# Step 2: Build prompts
	system_prompt = build_system_prompt()
	user_prompt = build_user_prompt(doc.raw_report_text, doc.report_date, candidates)
	response_schema = get_response_schema()

	# Step 3: Call OpenAI
	ai_response = call_openai_structured(
		system_prompt=system_prompt,
		user_prompt=user_prompt,
		response_schema=response_schema,
		model=settings.openai_model,
		timeout=settings.request_timeout_seconds,
	)

	# Step 4: Store audit payloads
	doc.ai_request_payload = ai_response["request_payload"]
	doc.ai_response_payload = ai_response["response_payload"]
	doc.ai_model_used = ai_response["model"]
	doc.ai_processed_on = now_datetime()

	# Step 5: Validate and apply to document
	parsed = ai_response["parsed"]
	result = validate_and_apply(doc, parsed, settings)

	return result


def _build_result_message(doc):
	"""Build a user-friendly result message."""
	parts = [f"Classification completed with {len(doc.extracted_lines)} line(s)."]
	if doc.primary_customer:
		parts.append(f"Primary customer: {doc.primary_customer}")
	if doc.review_required:
		parts.append("Review required — some fields need verification.")
	if doc.ai_confidence_avg:
		parts.append(f"Average confidence: {doc.ai_confidence_avg:.0%}")
	return " ".join(parts)
