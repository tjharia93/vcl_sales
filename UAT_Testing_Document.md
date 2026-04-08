# VCL Sales Dashboard — UAT (User Acceptance Testing) Document

**Application:** VCL Sales Dashboard (vcl_sales_dashboard)
**Version:** Production Hardening Release
**Date:** April 2026
**Prepared for:** Vimit Converters Limited

---

## 1. Purpose

This UAT validates that the VCL Sales Dashboard meets the business requirements of the sales team, finance team, and management. Testing is performed by actual end users in their real roles.

---

## 2. Test Users Required

| Role | Test User | ERPNext User Permission Setup Required |
|------|-----------|---------------------------------------|
| Sales User | A sales rep (e.g. neema@vimit.com) | User Permission: Sales Person = Neema |
| Sales Manager | A manager account | No Sales Person restriction needed |
| Finance Manager | Finance user (e.g. tanuj.haria@vimit.com) | No Sales Person restriction needed |
| System Manager | Admin account | Full access |

**Setup before testing:** Ensure each Sales User has a User Permission record:
- Go to `/app/user-permission/new`
- User = `neema@vimit.com`, Allow = `Sales Person`, For Value = `Neema`

---

## 3. Test Scenarios

### Module A: Sales Dashboard (`/sales-dashboard`)

#### A1: Sales User — Own Scope View

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| A1.1 | Login as Sales User (e.g. Neema) | Dashboard loads successfully | | |
| A1.2 | Check KPI cards (Net Sales MTD/YTD) | Shows only Neema's sales totals, NOT company-wide | | |
| A1.3 | Check Outstanding/Overdue KPIs | Shows only Neema's customer overdue amounts | | |
| A1.4 | Check Sales Rep filter dropdown | Locked to "Neema" only, disabled/greyed out | | |
| A1.5 | Check Performance Table | Shows only Neema's row (Actual, Target, Delta, % Achieved) | | |
| A1.6 | Verify no other rep's data visible anywhere | No other rep names, no company totals | | |
| A1.7 | User name and role displayed in top bar | Shows "Neema [full name]" and "Sales User" | | |

#### A2: Sales Manager — Full View

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| A2.1 | Login as Sales Manager | Dashboard loads with all data | | |
| A2.2 | KPI cards show company-wide totals | Net Sales reflects all reps | | |
| A2.3 | Sales Rep filter shows all reps | Dropdown has "All Sales Persons" + each rep name | | |
| A2.4 | Select "Neema" in Sales Rep filter | KPIs and table filter to Neema only | | |
| A2.5 | Select "All Sales Persons" | Returns to full company view | | |
| A2.6 | Performance Table shows all reps | All reps listed with Actual, Target, Delta, % | | |
| A2.7 | Performance Table has total row | "Sales Team Total" row at bottom with sums | | |
| A2.8 | Toggle MTD / YTD | Table refreshes with correct period values | | |
| A2.9 | Rep names are clean display names | No email addresses, no "Administrator", no technical IDs | | |
| A2.10 | Delta formatting correct | Positive = normal/green, Negative = brackets + red | | |
| A2.11 | % Achieved indicators correct | Green dot >=90%, Amber 75-89%, Red <75% | | |

#### A3: Performance Table — Data Accuracy

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| A3.1 | Compare MTD Actual for one rep against ERPNext Sales Invoice report | Values match | | |
| A3.2 | Compare YTD Actual for one rep against ERPNext | Values match | | |
| A3.3 | Verify Target values come from targets file | Monthly target for current month matches JSON | | |
| A3.4 | Verify Delta = Actual - Target | Math correct for each row | | |
| A3.5 | Verify % = (Actual / Target) * 100 | Calculation correct, handles zero target safely | | |
| A3.6 | Rep with no target | % shows 100% if actual > 0, 0% if no actual | | |

---

### Module B: Collections Dashboard (`/sales-collections`)

#### B1: Viewing Collections Data

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| B1.1 | Navigate to Collections Dashboard | KPI cards load: Total Book, Overdue, Overdue 30+, Due This Month | | |
| B1.2 | Select a period from dropdown | Data refreshes for selected period | | |
| B1.3 | Customer list shows 50 rows per page | Pagination works (Next/Prev) | | |
| B1.4 | Click a customer row | Detail panel opens with ageing buckets, totals, follow-up history | | |
| B1.5 | Sales User sees only their customers | List filtered by permitted Sales Person | | |
| B1.6 | Manager sees all customers | Full list with rep column populated | | |

#### B2: Sales Rep Filter (Manager Only)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| B2.1 | Manager: select rep "Neema" | Customer list shows only Neema's customers | | |
| B2.2 | Manager: select "All Reps" | Full customer list returns | | |
| B2.3 | KPI cards update when rep filter changes | Totals reflect filtered scope | | |
| B2.4 | Rep Summary table updates | Shows filtered rep data | | |
| B2.5 | Search + Rep filter combined | Shows only matching customers for that rep | | |

#### B3: Follow-Up Workflow

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| B3.1 | Open customer detail panel | Follow-up history visible (or "No follow-ups yet") | | |
| B3.2 | Fill in follow-up form: Type, Status, Comment | All fields accept input | | |
| B3.3 | Click "Save Follow-Up" | Follow-up saved, timeline updates, status badge changes | | |
| B3.4 | Set "Promise to Pay" with date and amount | Fields saved, snapshot updated | | |
| B3.5 | Verify snapshot reflects latest follow-up | latest_follow_up_status updated in customer list | | |
| B3.6 | Sales User can only follow up on own customers | Cannot save follow-up for another rep's customer | | |

#### B4: Warning Queues (Manager)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| B4.1 | Review Queues section visible for managers | 7 queue cards with counts | | |
| B4.2 | Click "Customer Not Matched" card | Table expands showing unmatched customers | | |
| B4.3 | Click "Overdue No Contact" card | Shows overdue customers with "Not Contacted" status | | |
| B4.4 | Click a row in warning queue | Detail panel opens for that customer | | |

#### B5: Terms Discrepancy Report (Manager)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| B5.1 | Terms Discrepancy section visible | Summary badges show counts by status | | |
| B5.2 | Click "Show" to expand detail table | Rows with File Terms, ERPNext Terms, Status visible | | |
| B5.3 | Blank terms shown as red "BLANK" | Visual indicator for missing terms | | |
| B5.4 | Mismatch rows highlighted | Mismatched terms clearly visible | | |

---

### Module C: Collections Submission (`/sales-collections-submission`)

#### C1: Access Control

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| C1.1 | Finance Manager can access page | Page loads with form | | |
| C1.2 | Sales User cannot access page | 403 error, redirected or denied | | |
| C1.3 | Sales Manager cannot access page | 403 error | | |

#### C2: File Upload & Validation

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| C2.1 | Select period end date (e.g. 31/03/2026) | Date picker works | | |
| C2.2 | Upload valid ageing report Excel file | File accepted (shows filename) | | |
| C2.3 | Click "Validate File" | Status changes to "Validated", log shows rows/columns found | | |
| C2.4 | Upload file without "Ageing Report" sheet | Clear error: "Sheet 'Ageing Report' not found" | | |
| C2.5 | Upload non-Excel file | Error: "File must be an Excel file" | | |

#### C3: Unresolved Rep Mapping

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| C3.1 | File has rep labels not matching any User | Popup: "Unresolved Sales Rep Users" appears | | |
| C3.2 | Popup shows each unresolved label with user dropdown | Dropdowns populated with active users | | |
| C3.3 | Select users for each label, click "Save Mappings & Continue" | Mappings saved, validation re-runs | | |
| C3.4 | Next upload with same labels | No popup (mappings already saved) | | |
| C3.5 | Click "Skip" | Processing continues with unresolved reps as warnings | | |

#### C4: Processing

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| C4.1 | Click "Process Submission" | Status changes to "Processed", summary grid shows counts | | |
| C4.2 | Verify rows_imported matches expected count | e.g. 622 rows imported | | |
| C4.3 | Verify customers_matched count is reasonable | Most customers should match | | |
| C4.4 | Verify validation log shows warnings | Unmatched customers, unresolved reps listed | | |
| C4.5 | Navigate to Collections Dashboard | New period appears in dropdown, data visible | | |

#### C5: Duplicate Period Handling

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| C5.1 | Submit same period again WITHOUT "Replace" checked | Error: "A submission already exists for period..." | | |
| C5.2 | Submit same period WITH "Replace" checked | Old data replaced, new data imported | | |
| C5.3 | Past Submissions list shows both entries | Latest = Processed, previous = Draft | | |

---

### Module D: Sales Discrepancy Report (`/sales-discrepancy`)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| D1 | Manager navigates to page | Discrepancy report loads | | |
| D2 | Sales User cannot access | 403 error | | |
| D3 | Report shows mismatched rep assignments | Mismatches between CSR and document sales person visible | | |

---

### Module E: Management Dashboard (`/sales-manager`)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| E1 | Manager navigates to page | Dashboard loads with all sections | | |
| E2 | Rep Performance table populated | Each rep with MTD sales, collections, overdue | | |
| E3 | Pipeline Summary KPIs show values | Open quotes, open orders with counts and values | | |
| E4 | Collection Risk section populated | Overdue by rep + top overdue customers | | |
| E5 | Key Exceptions table shows items | Expiring quotes, delayed orders, high overdue | | |
| E6 | Territory filter works | Refresh button reloads filtered data | | |
| E7 | Sales User cannot access | 403 error | | |

---

### Module F: Customer 360 (`/sales-customer/<name>`)

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| F1 | Navigate to a valid customer page | Customer header, KPIs, tables load | | |
| F2 | Recent invoices table shows data | Invoices with amounts, dates, status | | |
| F3 | Recent payments table shows data | Payments with dates, amounts, mode | | |
| F4 | Open documents table shows data | Quotations, orders, delivery notes | | |
| F5 | Ageing breakdown shows buckets | 4 bucket cards with values | | |
| F6 | Sales User accessing own customer | Access granted, data shown | | |
| F7 | Sales User accessing another rep's customer | Access denied (403) | | |
| F8 | Manager accessing any customer | Access granted | | |

---

### Module G: Cross-Cutting Concerns

#### G1: Navigation

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| G1.1 | Nav bar consistent on all pages | Same links: Sales Invoice, Collections, Discrepancy, Desk | | |
| G1.2 | Active page highlighted in nav | Current page tab has visual emphasis | | |
| G1.3 | Desk link opens ERPNext backend | `/app` loads correctly | | |

#### G2: Session Handling

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| G2.1 | Session expires during page use | Login popup appears, not a raw error | | |
| G2.2 | After re-login, returns to same page | Redirect-to parameter works | | |
| G2.3 | Form state preserved across login | Period end and notes restored (submission page) | | |

#### G3: Mobile Usability

| # | Step | Expected Result | Status | Notes |
|---|------|----------------|--------|-------|
| G3.1 | Sales Dashboard on mobile | KPI cards stack, table scrolls horizontally | | |
| G3.2 | Collections Dashboard on mobile | Customer list readable, detail panel full-width | | |
| G3.3 | Collections Submission on mobile | Form fields stack, buttons accessible | | |
| G3.4 | Performance Table on mobile | Horizontal scroll, all columns accessible | | |

---

## 4. Ageing Calculation Verification

### Test with known customer data

| # | Test | Setup | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | 60-day terms customer | Customer with terms "60 Days" | Due CM = bucket_46_60, Overdue = sum(bucket_61_75+), Overdue 30+ = sum(bucket_91_105+) | |
| 4.2 | 30-day terms customer | Customer with terms "30 Days" | Due CM = bucket_16_30, Overdue = sum(bucket_31_45+) | |
| 4.3 | No terms (blank) | Customer with no terms | Default 0-day: Due CM = bucket_current, Overdue = sum(bucket_1_15+) | |
| 4.4 | "Current" terms | Terms = "Current" | Same as 0-day calculation | |
| 4.5 | Terms mismatch | File="60 Days", ERPNext="30 Days" | terms_match_status = "Mismatch", file terms used for calculation | |

---

## 5. Data Reconciliation Checklist

| # | Check | Method | Status |
|---|-------|--------|--------|
| 5.1 | Total Book on dashboard = Sum of all customer total_balance | Compare KPI vs manual sum | |
| 5.2 | Net Sales MTD = ERPNext Sales Invoice report (submitted, current month) | Cross-reference | |
| 5.3 | Per-rep MTD Actual matches ERPNext when filtered by Sales Person | Cross-reference per rep | |
| 5.4 | Customer count on collections = rows imported from file | Verify counts match | |
| 5.5 | Follow-up status updates reflect in customer list | Status badge changes after follow-up | |

---

## 6. Known Limitations (Phase 1)

| Item | Description |
|------|-------------|
| Targets | Stored in JSON file; not yet in ERPNext DocType. Changes require code deployment. |
| Sales Person matching | Relies on `sales_representative` field in Customer Sales Rep Assignment matching `Sales Person` name exactly. |
| Customer matching | Phase 1 uses exact/case-insensitive name match. No fuzzy matching. |
| Historical data | Dashboard shows current ownership, not historical attribution by transaction date. |
| Ageing calculation | Supports 0/15/30/45/60/75/90 day terms only. Non-standard terms snap to nearest. |

---

## 7. Defect Tracking

| # | Description | Severity | Found By | Status | Resolution |
|---|-------------|----------|----------|--------|------------|
| | | | | | |
| | | | | | |
| | | | | | |

---

## 8. UAT Sign-Off

| Role | Name | Test Date | Result | Signature |
|------|------|-----------|--------|-----------|
| Sales User Tester | | | ☐ Pass ☐ Fail | |
| Sales Manager Tester | | | ☐ Pass ☐ Fail | |
| Finance Manager Tester | | | ☐ Pass ☐ Fail | |
| Business Owner | | | ☐ Pass ☐ Fail | |

---

**UAT Status:** ☐ Accepted ☐ Conditionally Accepted ☐ Rejected

**Conditions (if applicable):**

**Go-Live Date:**

**Approved By:**
