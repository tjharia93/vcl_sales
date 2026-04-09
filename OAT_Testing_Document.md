# VCL Sales Dashboard — OAT (Operational Acceptance Testing) Document

**Application:** VCL Sales Dashboard (vcl_sales_dashboard)
**Version:** Production Hardening Release
**Date:** April 2026
**Prepared for:** Vimit Converters Limited
**Last Updated:** 2026-04-09 — Updated for performance table rendering fix, target mapping discrepancy report, and draft invoice inclusion.

---

## 1. Scope

This OAT validates that the VCL Sales Dashboard module is operationally ready for production use on Frappe Cloud. It covers infrastructure readiness, deployment health, data integrity, performance, security, and error handling.

---

## 2. Environment Details

| Item | Value |
|------|-------|
| Platform | Frappe Cloud |
| ERPNext Version | v16 |
| App Name | vcl_sales_dashboard |
| Database | MariaDB |
| Site | vimitconverters.frappe.cloud |

---

## 3. Pre-Deployment Checks

### 3.1 Build Validation

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1.1 | All Python files compile without syntax errors | No SyntaxError on deploy | |
| 3.1.2 | No Jinja template errors in HTML files (no literal `{{` in JavaScript) | Pages render without TemplateSyntaxError | |
| 3.1.3 | Chart.js CDN dependency removed (no external CDN) | No external script loads | |
| 3.1.4 | No `sales-dashboard-gold.html` in deployment | File deleted | |
| 3.1.5 | `formatKESFull()` helper defined in `sales-dashboard.html` | Performance table renders currency values without JS ReferenceError | |
| 3.1.6 | `get_sales_rep_discrepancies` has `@frappe.whitelist()` decorator and function definition | Discrepancy Report API callable | |

### 3.2 Migration

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.2.1 | `bench migrate` completes without errors | All DocTypes sync | |
| 3.2.2 | Collections Submission table created | `tabCollections Submission` exists | |
| 3.2.3 | Collections Customer Snapshot table created with new terms fields | `credit_days`, `terms_from_file`, `terms_match_status` columns exist | |
| 3.2.4 | Collections Follow Up table created | Table exists with all fields | |
| 3.2.5 | Sales Rep User Mapping table created | Table exists with `sales_rep_label`, `user` fields | |

### 3.3 Route Accessibility

| # | Route | Expected Status | Pass/Fail |
|---|-------|----------------|-----------|
| 3.3.1 | `/sales-dashboard` | 200 for authenticated users | |
| 3.3.2 | `/sales-collections` | 200 for authenticated users | |
| 3.3.3 | `/sales-collections-submission` | 200 for Finance Manager, 403 for Sales User | |
| 3.3.4 | `/sales-discrepancy` | 200 for Sales Manager+, 403 for Sales User | |
| 3.3.5 | `/sales-manager` | 200 for Sales Manager+, 403 for Sales User | |
| 3.3.6 | `/sales-customer/<valid_name>` | 200 for permitted user | |
| 3.3.7 | `/sales-dashboard` as Guest | Redirect to `/login?redirect-to=/sales-dashboard` | |

---

## 4. API Health Checks

### 4.1 Sales Dashboard APIs

| # | Endpoint | Method | Expected | Pass/Fail |
|---|----------|--------|----------|-----------|
| 4.1.1 | `get_filter_options` | GET | Returns sales_reps, territories, customer_groups, user_scope | |
| 4.1.2 | `get_net_sales_summary` | GET | Returns mtd/ytd actual + target values | |
| 4.1.3 | `get_rep_performance_table` | GET | Returns MTD and YTD rows per rep with actual, target, delta, pct; also returns `unmapped_targets`, `mtd_expected_target`, `mtd_mapped_target`, `ytd_expected_target`, `ytd_mapped_target` | |
| 4.1.4 | `get_outstanding_invoices` | GET | Returns invoices array + summary | |
| 4.1.5 | `get_sales_by_person` | GET | Returns MTD/YTD aggregations by rep | |
| 4.1.6 | `get_sales_targets` | GET | Returns monthly/annual/YTD targets from JSON | |
| 4.1.7 | `get_target_discrepancies` | GET | Returns unmapped customer target entries (customers in targets JSON with no CSR assignment), including `mtd_unmapped`, `mtd_unmapped_total`, and full `discrepancies` list across all months | |
| 4.1.8 | `get_sales_rep_discrepancies` | GET | Returns document-level rep mismatches with summary counts (mismatch, missing_on_doc, no_csr_assignment) | |

### 4.2 Collections APIs

| # | Endpoint | Method | Expected | Pass/Fail |
|---|----------|--------|----------|-----------|
| 4.2.1 | `get_csrf_token` | GET | Returns valid CSRF token string | |
| 4.2.2 | `get_available_periods` | POST | Returns list of processed submission periods | |
| 4.2.3 | `get_collections_summary` | POST | Returns KPI totals for period | |
| 4.2.4 | `get_collections_customer_list` | POST | Returns filtered customer snapshots | |
| 4.2.5 | `get_warning_queues` | POST | Returns 7 warning queue categories with counts | |
| 4.2.6 | `get_terms_discrepancy` | POST | Returns terms match summary + detail rows | |
| 4.2.7 | `validate_submission_file` | POST | Validates Excel file structure | |
| 4.2.8 | `process_collections_submission` | POST | Processes file and creates snapshot rows | |

### 4.3 Management APIs

| # | Endpoint | Method | Expected | Pass/Fail |
|---|----------|--------|----------|-----------|
| 4.3.1 | `get_rep_performance` | GET | Returns per-rep performance metrics | |
| 4.3.2 | `get_pipeline_summary` | GET | Returns quotation/order pipeline | |
| 4.3.3 | `get_team_collection_risk` | GET | Returns overdue/risk summary | |
| 4.3.4 | `get_key_sales_exceptions` | GET | Returns exception categories | |

---

## 5. Security & Permission Checks

### 5.1 CSRF Token

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.1.1 | Page loads with CSRF token present | Debug shows "CSRF token: PRESENT" | |
| 5.1.2 | POST requests include valid X-Frappe-CSRF-Token header | No CSRFTokenError | |
| 5.1.3 | Custom `get_csrf_token` endpoint accessible | Returns token for authenticated users | |

### 5.2 Role-Based Access

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.2.1 | Sales User cannot access `/sales-manager` | 403 PermissionError | |
| 5.2.2 | Sales User cannot access `/sales-collections-submission` | 403 PermissionError | |
| 5.2.3 | Sales User cannot access `/sales-discrepancy` | 403 PermissionError | |
| 5.2.4 | Sales User can access `/sales-dashboard` | 200 OK | |
| 5.2.5 | Sales User can access `/sales-collections` | 200 OK | |

### 5.3 Scope Enforcement

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.3.1 | Sales User with Sales Person permission sees only own data | KPIs reflect own scope | |
| 5.3.2 | Sales User without any Sales Person permission sees empty dashboard | No data shown, clean empty state | |
| 5.3.3 | Sales User cannot see other reps' customers in any API response | API returns scoped data only | |
| 5.3.4 | Sales Rep filter locked/disabled for Sales User | Dropdown shows only own rep, disabled | |
| 5.3.5 | Manager can use Sales Rep filter freely | Dropdown shows all reps | |

### 5.4 Error Response Sanitization

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.4.1 | API errors return generic message to frontend | "An error occurred. Please try again." | |
| 5.4.2 | Full tracebacks logged in ERPNext Error Log | Check `/app/error-log` | |
| 5.4.3 | No SQL errors, schema details, or paths exposed to browser | Inspect network responses | |

---

## 6. Data Integrity Checks

### 6.1 Sales KPIs

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1.1 | Net Sales KPI cards use only submitted records (docstatus=1) | Drafts excluded from KPI card totals | |
| 6.1.2 | Performance table actuals include Draft + Submitted invoices (docstatus IN (0,1)) | Both draft and submitted invoices counted in rep actual values | |
| 6.1.3 | Payment Entry totals use only submitted records | Drafts excluded | |
| 6.1.4 | Quotation pipeline includes drafts intentionally | Drafts + submitted shown | |
| 6.1.5 | Net Sales MTD matches ERPNext Sales Invoice report for same period | Values align | |

### 6.1a Target Mapping Integrity

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1a.1 | Direct rep-name entries in targets JSON (e.g. "Gideon", "Keenda") are matched case-insensitively to CSR rep names | Rep target includes both customer-mapped and direct entries | |
| 6.1a.2 | Customer names in targets JSON without a CSR assignment are excluded from the performance table | Not added to "Other" or any rep; tracked as unmapped | |
| 6.1a.3 | `unmapped_targets` returned by `get_rep_performance_table` lists each unmapped customer with name, target, month | Array contains one entry per unmapped customer | |
| 6.1a.4 | `mtd_expected_target` matches `monthly_targets` value from targets JSON for current month | Values match exactly | |
| 6.1a.5 | `mtd_mapped_target` equals Sales Team Total target row in the table | Mapped total = sum of all rep targets in table | |
| 6.1a.6 | Gap between expected and mapped = sum of unmapped target amounts | `mtd_expected_target - mtd_mapped_target ≈ sum(unmapped_targets[].target)` | |

### 6.2 Collections Data

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.2.1 | Snapshot row count matches Excel row count | rows_imported matches expected | |
| 6.2.2 | Total balance matches Excel total | Sum of snapshot totals = file total | |
| 6.2.3 | Customer matching: exact name matches resolve | customer_match_status = "Matched" | |
| 6.2.4 | Overdue amounts calculated from buckets + terms | Not raw file values (when terms resolved) | |
| 6.2.5 | Blank terms default to 0-day calculation | Everything except Current is overdue | |

### 6.3 Sales Rep Resolution

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.3.1 | Rep label "Raheel" resolves to user via full_name match | sales_rep_user populated | |
| 6.3.2 | Unresolved rep label does not fail submission | assignment_match_status = "Imported With Warning" | |
| 6.3.3 | Sales Rep User Mapping used as fallback | Mapped labels resolve correctly | |

---

## 7. Performance Checks

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | Sales dashboard loads within 5 seconds | All KPIs and table render | |
| 7.2 | Collections dashboard loads within 5 seconds | KPIs and customer list render | |
| 7.3 | Collections submission processes 622 rows | Completes within 60 seconds | |
| 7.4 | Customer list pagination works | Next/Prev buttons functional | |
| 7.5 | Large file (25MB+) can be validated | Validation completes or clear error | |

---

## 8. Navigation & UX Checks

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | All pages have consistent nav bar | Sales Invoice, Collections, Discrepancy Report, Management, Desk | |
| 8.2 | Active page highlighted in nav | Current page has `is-active` class | |
| 8.3 | No disabled/placeholder nav links visible | All nav items lead to working pages | |
| 8.4 | User name and role displayed in dashboard topbar | Shows full name + role badge | |
| 8.5 | Login redirect returns to correct page | After login, lands on page user was accessing | |
| 8.6 | Debug panel hidden in production | Not visible unless `?debug=1` in URL | |
| 8.7 | Mobile: pages usable on phone screen | Content readable, horizontal scroll for tables | |
| 8.8 | Unmapped targets warning banner visible below performance table when gap exists | Yellow banner showing count, amount, and link to Discrepancy Report | |
| 8.9 | Warning banner hidden when all targets are fully mapped | Banner has `display:none` | |
| 8.10 | Discrepancy Report page shows "Unmapped Customer Targets" section | Table with Customer Name, Month, Target Amount, Action Needed columns | |

---

## 9. Error Handling Checks

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9.1 | Session expired during operation | Login popup shown with redirect | |
| 9.2 | Missing required field on submission | Clear error message shown | |
| 9.3 | Invalid Excel file uploaded | "File must be an Excel file" error | |
| 9.4 | Excel missing "Ageing Report" sheet | Clear error with available sheet names | |
| 9.5 | Duplicate period submission blocked | Error with existing submission name unless Replace checked | |
| 9.6 | Performance table API returns null/error | Table shows "Could not load performance data" instead of permanent "Loading..." | |
| 9.7 | Performance table JS rendering throws error | Caught by try/catch; table shows "Could not load performance data" | |

---

## 10. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Operations Lead | | | |
| Technical Lead | | | |
| Finance Manager | | | |
| System Administrator | | | |

---

**OAT Status:** ☐ Pass ☐ Conditional Pass ☐ Fail

**Notes:**
