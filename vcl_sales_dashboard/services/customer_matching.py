import frappe
from frappe.utils import cstr


def get_customer_candidates(raw_text, max_candidates=20):
	"""Extract potential customer names from raw text and find matching ERPNext customers.

	Returns a list of dicts: [{name, customer_name, territory, ...}]
	"""
	keywords = _extract_keywords(raw_text)
	if not keywords:
		return []

	candidates = set()
	for keyword in keywords:
		if len(keyword) < 2:
			continue
		results = frappe.get_all(
			"Customer",
			filters={"customer_name": ("like", f"%{keyword}%")},
			fields=["name", "customer_name", "territory", "customer_group"],
			limit=max_candidates,
		)
		for r in results:
			candidates.add(r["name"])

	# Fetch full details for unique candidates
	if not candidates:
		return []

	customer_list = frappe.get_all(
		"Customer",
		filters={"name": ("in", list(candidates))},
		fields=["name", "customer_name", "territory", "customer_group"],
		limit=max_candidates,
	)
	return customer_list


def _extract_keywords(raw_text):
	"""Extract likely customer name keywords from raw report text.

	Uses simple heuristics: capitalized words, words after visit/met/called markers.
	"""
	import re

	text = cstr(raw_text).strip()
	if not text:
		return []

	keywords = set()

	# Look for words after common sales visit markers
	markers = [
		r"(?:visited|met|called|at|from|customer|client|company)\s+([A-Z][\w\s]{1,40}?)(?:\.|,|;|\n|$)",
	]
	for pattern in markers:
		matches = re.findall(pattern, text, re.IGNORECASE)
		for match in matches:
			cleaned = match.strip().rstrip(".")
			if cleaned and len(cleaned) > 1:
				keywords.add(cleaned)

	# Also grab capitalized multi-word sequences (likely proper nouns / customer names)
	proper_nouns = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", text)
	stop_words = {
		"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
		"January", "February", "March", "April", "May", "June", "July",
		"August", "September", "October", "November", "December",
		"Visited", "Called", "Met", "Wants", "Waiting", "Follow",
		"Order", "Payment", "Delivery", "Complaint", "Quote",
	}
	for noun in proper_nouns:
		if noun not in stop_words and len(noun) > 2:
			keywords.add(noun)

	return list(keywords)[:20]


def resolve_customer_link(customer_code, customer_name):
	"""Validate that a customer code or name exists in ERPNext and return the link name."""
	if customer_code:
		if frappe.db.exists("Customer", customer_code):
			return customer_code

	if customer_name:
		match = frappe.db.get_value(
			"Customer",
			{"customer_name": customer_name},
			"name",
		)
		if match:
			return match

	return None
