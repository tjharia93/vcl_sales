# OAT — Operational Acceptance Testing

## AI Daily Sales Report Classification System

**App:** vcl_sales_dashboard
**Module:** VCL Sales Dashboard
**Version:** Phase 1
**Date:** 2026-04-08

---

## 1. Purpose

This document defines the Operational Acceptance Tests for the AI Daily Sales Report feature. OAT validates that the system is production-ready from an infrastructure, configuration, security, performance, error-handling, and audit perspective — independent of business-logic correctness (covered by UAT).

---

## 2. Pre-Requisites

Before running OAT, confirm:

- [ ] ERPNext site is running and accessible
- [ ] `bench migrate` has been run after deploying the branch
- [ ] The three new DocTypes are visible in the DocType list:
  - AI Daily Sales Report
  - AI Daily Sales Report Line
  - Sales AI Settings
- [ ] At least one Customer record exists in ERPNext
- [ ] A valid OpenAI API key is available for testing
- [ ] Test users exist for each role: Sales User, Sales Manager, System Manager

---

## 3. Configuration & Settings Tests

### OAT-CFG-01: Sales AI Settings DocType exists and is accessible

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to **Sales AI Settings** in the search bar | Singleton form opens |
| 2 | Verify all fields are present | `enable_sales_ai`, `openai_api_key`, `openai_model`, `request_timeout_seconds`, `max_retries`, `customer_match_threshold_high`, `customer_match_threshold_low`, `max_candidate_customers`, `allow_auto_fill_candidate_customer`, `classification_confidence_threshold`, `default_review_required_below_confidence`, `active_prompt_version` |
| 3 | Verify default values | `openai_model` = "gpt-4o", `request_timeout_seconds` = 30, `max_retries` = 2, `customer_match_threshold_high` = 0.90, `customer_match_threshold_low` = 0.75, `max_candidate_customers` = 20, `classification_confidence_threshold` = 0.75, `default_review_required_below_confidence` = 0.80, `active_prompt_version` = "v1.0" |

### OAT-CFG-02: Settings validation — AI enabled without API key

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Sales AI Settings | Form loads |
| 2 | Check "Enable Sales AI" | Checkbox ticked |
| 3 | Leave OpenAI API Key blank | Field empty |
| 4 | Click Save | Error: "OpenAI API Key is required when Sales AI is enabled." |

### OAT-CFG-03: Settings validation — threshold ordering

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set `customer_match_threshold_low` = 0.95 | Value entered |
| 2 | Set `customer_match_threshold_high` = 0.80 | Value entered |
| 3 | Click Save | Error: "Low Confidence Threshold must be less than High Confidence Threshold." |

### OAT-CFG-04: Settings — valid configuration saves

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check "Enable Sales AI" | Ticked |
| 2 | Enter a valid OpenAI API Key | Key entered (masked as password) |
| 3 | Set model to "gpt-4o" | Value set |
| 4 | Leave thresholds at defaults | Defaults preserved |
| 5 | Click Save | Saved successfully, green toast |

---

## 4. DocType & Schema Tests

### OAT-DT-01: AI Daily Sales Report DocType structure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to new AI Daily Sales Report | Form opens |
| 2 | Verify naming series | Auto-named as `AISR-{YYYY}-{#####}` |
| 3 | Verify `report_date` defaults to today | Today's date pre-filled |
| 4 | Verify `sales_user` defaults to current user | Logged-in user pre-filled |
| 5 | Verify `report_source` defaults to "Manual Entry" | Default selected |
| 6 | Verify `ai_processing_status` defaults to "Not Processed" | Default shown, read-only |
| 7 | Verify `raw_report_text` is mandatory | Marked with red asterisk |
| 8 | Verify Extracted Lines child table is present | Table visible (may be hidden until AI runs via `depends_on`) |
| 9 | Verify Audit section is collapsible | Section collapsed by default |
| 10 | Verify document is submittable | Submit button available after classification |

### OAT-DT-02: AI Daily Sales Report Line child table structure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | After classification, expand Extracted Lines grid | Grid visible with columns |
| 2 | Verify list-view columns | `raw_line_text`, `raw_customer_text`, `report_type`, `status`, `confidence`, `needs_review` |
| 3 | Verify Select field options match allowed enums | Report Type has 10 options, Status has 15 options, Priority has 4, Sentiment has 4, Customer Match Type has 4 |

### OAT-DT-03: Track Changes enabled

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit and save an AI Daily Sales Report | Change recorded |
| 2 | Scroll to Activity section | Version log shows field-level changes |

---

## 5. Permission & Security Tests

### OAT-SEC-01: Sales User permissions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Sales User | Dashboard loads |
| 2 | Create new AI Daily Sales Report | Form opens, can save |
| 3 | Attempt to Submit (before classification) | Blocked: "Cannot submit a report that has not been classified" |
| 4 | Attempt to Submit (after classification, review required) | Blocked: "This report requires review before submission" |
| 5 | Attempt to delete a record | Blocked (no delete permission for Sales User) |

### OAT-SEC-02: Sales Manager permissions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Sales Manager | Dashboard loads |
| 2 | Open another user's AI Daily Sales Report | Read access confirmed |
| 3 | Edit classified fields on another user's report | Write access confirmed |
| 4 | Click Approve | Approval succeeds, `reviewed_by` set to current manager |
| 5 | Submit the approved report | Submit succeeds |
| 6 | Delete a report | Delete allowed |

### OAT-SEC-03: System Manager — full access

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as System Manager | All operations available |
| 2 | Access Sales AI Settings | Full read/write |
| 3 | Access Audit fields on any report | Visible and readable |

### OAT-SEC-04: OpenAI API key is never exposed to the browser

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open Sales AI Settings in browser | API key shows as masked dots (Password fieldtype) |
| 2 | Open browser DevTools > Network tab | No API response contains the raw key value |
| 3 | Inspect `ai_request_payload` on a classified report | The Authorization header is **not** stored in the payload (only the request body is logged) |
| 4 | Inspect page source of the AI Daily Sales Report form | No OpenAI key present in HTML or JS |

### OAT-SEC-05: API method access control

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `/api/method/vcl_sales_dashboard.api.sales_report_ai.classify_sales_report` as Guest | Blocked (403 / login required) |
| 2 | Call the same method as logged-in Sales User with own report | Succeeds |

---

## 6. API & Integration Tests

### OAT-API-01: Whitelisted method — classify_sales_report responds correctly

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create and save a report with valid text | Report saved |
| 2 | Call `classify_sales_report` via form button | Returns JSON with keys: `success`, `docname`, `processing_status`, `review_required`, `primary_customer`, `line_count`, `duration_ms`, `message` |
| 3 | Verify `success` is `true` | Confirmed |
| 4 | Verify `processing_status` is "Processed" or "Needs Review" | One of the two values |

### OAT-API-02: Whitelisted method — approve_ai_report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report first | Status is Processed or Needs Review |
| 2 | Call `approve_ai_report` | Returns `{success: true, message: "Report approved by ..."}` |
| 3 | Reload document | `review_status` = "Approved", `reviewed_by` populated, `reviewed_on` populated |

### OAT-API-03: Whitelisted method — get_customer_candidates

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create report with text mentioning a known customer name | Report saved |
| 2 | Call `get_customer_candidates` | Returns array of dicts with `name`, `customer_name`, `territory`, `customer_group` |
| 3 | Verify at least one result matches the expected customer | Candidate present |

### OAT-API-04: OpenAI API connectivity

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Configure valid API key in Sales AI Settings | Saved |
| 2 | Classify a simple report | OpenAI responds, structured JSON parsed |
| 3 | Verify `ai_model_used` field is populated | Shows model name (e.g. "gpt-4o-2024-...") |
| 4 | Verify `ai_request_payload` is populated | Full request JSON stored |
| 5 | Verify `ai_response_payload` is populated | Full response JSON stored |

---

## 7. Error Handling & Resilience Tests

### OAT-ERR-01: Missing API key

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Remove the OpenAI API key from Settings, keep AI enabled | Saved |
| 2 | Click "Classify with AI" on a report | Error message: "OpenAI API key is not configured. Go to Sales AI Settings." |
| 3 | Verify document is not corrupted | `ai_processing_status` = "Failed", raw text preserved, no partial overwrites |

### OAT-ERR-02: Sales AI disabled

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Uncheck "Enable Sales AI" in Settings | Saved |
| 2 | Click "Classify with AI" | Error: "Sales AI is disabled. Enable it in Sales AI Settings." |

### OAT-ERR-03: OpenAI timeout

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set `request_timeout_seconds` to 1 in Settings | Saved |
| 2 | Submit a long report text for classification | Timeout error displayed |
| 3 | Verify `ai_processing_status` = "Failed" | Confirmed |
| 4 | Verify `ai_error_log` contains timestamped error | Log entry present |
| 5 | Verify `processing_attempts` incremented | Count increased by 1 |
| 6 | Verify raw text is preserved | Unchanged |

### OAT-ERR-04: Invalid/corrupt OpenAI response

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | (Simulated: mock OpenAI to return malformed JSON) | Response received |
| 2 | System attempts to parse | Parse failure caught |
| 3 | Verify `ai_processing_status` = "Failed" | Confirmed |
| 4 | Verify `ai_error_log` records the parse error | Error logged with timestamp |
| 5 | Verify no partial field overwrites occurred | Primary summary and child rows unchanged from prior state |

### OAT-ERR-05: Empty raw text

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create report, leave raw text blank | Field empty |
| 2 | Attempt to save | Validation error: "Raw Report Text cannot be empty." |
| 3 | Enter only whitespace, save, then click Classify | Error: "Raw Report Text is empty. Nothing to classify." |

### OAT-ERR-06: Double-click / concurrent processing guard

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Classify with AI" | Processing starts, status = "Processing" |
| 2 | Immediately call `classify_sales_report` again via API | Error: "This report is already being processed. Please wait." |

### OAT-ERR-07: Reclassify without force flag

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report successfully | Status = Processed |
| 2 | Click "Classify with AI" (not Rerun) | Error: "This report has already been classified. Use 'Rerun AI' to force reprocessing." |

### OAT-ERR-08: Classify a submitted report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit an approved report | Docstatus = 1 |
| 2 | Attempt to call `classify_sales_report` via API | Error: "Cannot reclassify a submitted report. Amend it first." |

---

## 8. Performance Tests

### OAT-PERF-01: Classification response time — single line report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create report: "Visited Metro. Wants 400 dz A5 books. Follow up Tuesday." | Saved |
| 2 | Click "Classify with AI", record `duration_ms` from response | Target: < 5,000 ms (good), < 10,000 ms (acceptable) |
| 3 | Repeat 3 times, note average | Consistent within target |

### OAT-PERF-02: Classification response time — multi-line report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create report with 5 distinct customer updates (see UAT sample texts) | Saved |
| 2 | Click "Classify with AI", record `duration_ms` | Target: < 10,000 ms |

### OAT-PERF-03: Customer candidate lookup performance

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `get_customer_candidates` on a report mentioning 3 customers | Returns in < 500 ms |
| 2 | Verify result count <= `max_candidate_customers` setting | Count within limit |

### OAT-PERF-04: Form load time with classified data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open a classified report with 5 extracted lines | Form loads in < 2 seconds |
| 2 | Verify all sections render | All fields, child table, audit section visible |

---

## 9. Audit & Logging Tests

### OAT-AUD-01: Request payload logged

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report | Classification completes |
| 2 | Expand Audit section | `ai_request_payload` populated |
| 3 | Parse the JSON | Contains: `model`, `messages` (system + user), `response_format`, `temperature` |
| 4 | Verify candidate customers are included in user message | Customer list present |
| 5 | Verify raw report text is included | Text present |
| 6 | Verify OpenAI API key is NOT in the payload | Not present (auth header not logged) |

### OAT-AUD-02: Response payload logged

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check `ai_response_payload` on same report | Populated |
| 2 | Parse the JSON | Contains full OpenAI response including `choices`, `usage`, `model` |

### OAT-AUD-03: Processing metadata

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check `ai_processed_on` | Datetime set to when classification ran |
| 2 | Check `ai_model_used` | Matches configured model |
| 3 | Check `processing_attempts` | Equals 1 for first run |
| 4 | Check `last_processing_duration_ms` | Positive integer |

### OAT-AUD-04: Error log on failure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger a classification failure (e.g., bad API key) | Fails |
| 2 | Check `ai_error_log` | Contains timestamped error message |
| 3 | Trigger another failure | Error appended (not overwritten) |
| 4 | Check `processing_attempts` | Incremented to 2 |

### OAT-AUD-05: Review trail

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Approve a report as Sales Manager | Approved |
| 2 | Verify `reviewed_by` | Manager's user ID |
| 3 | Verify `reviewed_on` | Datetime of approval |
| 4 | Verify `review_status` | "Approved" |

---

## 10. Data Integrity Tests

### OAT-DATA-01: Enum values never contain unapproved values

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify 5 different reports | All complete |
| 2 | Query all AI Daily Sales Report Line rows | Every `report_type` is one of the 10 allowed values or blank |
| 3 | Every `status` is one of the 15 allowed values or blank | Confirmed |
| 4 | Every `priority` is one of: Low, Medium, High, Critical, or blank | Confirmed |
| 5 | Every `sentiment` is one of: Positive, Neutral, Negative, Mixed, or blank | Confirmed |
| 6 | Every `customer_match_type` is one of: Exact, Fuzzy, Candidate Only, Unmatched, or blank | Confirmed |

### OAT-DATA-02: Confidence values within bounds

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Query all `confidence` values in Report Lines | All between 0.0 and 1.0 |
| 2 | Query all `ai_confidence_avg` values in parent reports | All between 0.0 and 1.0 |
| 3 | Query all `customer_match_score` values | All between 0.0 and 1.0 |

### OAT-DATA-03: Customer link integrity

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Query all `primary_customer` values (non-blank) | Every value is a valid Customer name in ERPNext |
| 2 | Query all `matched_customer` values in child rows (non-blank) | Every value is a valid Customer name in ERPNext |

### OAT-DATA-04: Date field validity

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Query all `primary_followup_date` values (non-null) | All are valid dates in YYYY-MM-DD format |
| 2 | Query all `followup_date` values in child rows (non-null) | All are valid dates |

### OAT-DATA-05: No silent overwrite of reviewed data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report, then Approve it | Status = Approved |
| 2 | Click "Rerun AI" | Warning displayed: "Reprocessing will overwrite previously reviewed data" + confirmation dialog |
| 3 | Cancel the rerun | Data unchanged |

---

## 11. Operational Procedure Tests

### OAT-OPS-01: Manual retry after failure

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cause a classification failure | Status = Failed |
| 2 | Fix the root cause (e.g., restore API key) | Settings corrected |
| 3 | Click "Classify with AI" again | Button visible on Failed status |
| 4 | Classification succeeds | Status changes to Processed or Needs Review |
| 5 | Verify `processing_attempts` = 2 | Incremented |

### OAT-OPS-02: Amend-and-reclassify flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit a fully approved report | Docstatus = 1 |
| 2 | Click Amend | New draft created with `amended_from` linked |
| 3 | Modify raw text | Text changed |
| 4 | Click "Classify with AI" | Classification runs on new draft |
| 5 | Approve and submit | New submitted version created |

---

## 12. Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| DevOps / Infra | | | Pass / Fail |
| System Manager | | | Pass / Fail |
| QA Lead | | | Pass / Fail |
