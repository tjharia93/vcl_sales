import json

import frappe
from frappe import _


def call_openai_structured(system_prompt, user_prompt, response_schema, model=None, timeout=30):
	"""Call OpenAI API with structured output enforcement.

	Returns the parsed JSON response dict on success, or raises on failure.
	"""
	import requests

	settings = frappe.get_single("Sales AI Settings")
	api_key = settings.get_password("openai_api_key")
	if not api_key:
		frappe.throw(_("OpenAI API key is not configured. Go to Sales AI Settings."))

	model = model or settings.openai_model or "gpt-4o"
	timeout = timeout or settings.request_timeout_seconds or 30

	headers = {
		"Authorization": f"Bearer {api_key}",
		"Content-Type": "application/json",
	}

	payload = {
		"model": model,
		"messages": [
			{"role": "system", "content": system_prompt},
			{"role": "user", "content": user_prompt},
		],
		"response_format": {
			"type": "json_schema",
			"json_schema": {
				"name": "sales_report_classification",
				"strict": True,
				"schema": response_schema,
			},
		},
		"temperature": 0.1,
	}

	request_payload_str = json.dumps(payload, default=str)

	try:
		response = requests.post(
			"https://api.openai.com/v1/chat/completions",
			headers=headers,
			json=payload,
			timeout=timeout,
		)
		response.raise_for_status()
	except requests.exceptions.Timeout:
		frappe.throw(_("OpenAI API request timed out after {0} seconds.").format(timeout))
	except requests.exceptions.HTTPError as e:
		error_body = ""
		try:
			error_body = e.response.text
		except Exception:
			pass
		frappe.throw(
			_("OpenAI API error ({0}): {1}").format(e.response.status_code, error_body)
		)
	except requests.exceptions.RequestException as e:
		frappe.throw(_("OpenAI API connection error: {0}").format(str(e)))

	response_data = response.json()
	response_payload_str = json.dumps(response_data, default=str)

	# Extract the structured content from the response
	try:
		content_str = response_data["choices"][0]["message"]["content"]
		parsed = json.loads(content_str)
	except (KeyError, IndexError, json.JSONDecodeError) as e:
		frappe.throw(
			_("Failed to parse OpenAI response: {0}").format(str(e))
		)

	return {
		"parsed": parsed,
		"model": response_data.get("model", model),
		"request_payload": request_payload_str,
		"response_payload": response_payload_str,
	}
