# UAT — User Acceptance Testing

## AI Daily Sales Report Classification System

**App:** vcl_sales_dashboard
**Module:** VCL Sales Dashboard
**Version:** Phase 1
**Date:** 2026-04-08

---

## 1. Purpose

This document defines the User Acceptance Tests for the AI Daily Sales Report feature. UAT validates that the system correctly classifies real-world Vimit sales rep notes into structured business data, matches customers accurately, flags uncertainty for review, and supports the full review-and-submit workflow from a business user's perspective.

---

## 2. Test Data Prerequisites

Before running UAT, ensure the following Customer records exist in ERPNext (or substitute with your actual customer names):

| Customer Name | Customer ID (example) | Territory |
|---|---|---|
| Metro School | CUST-00045 | Nairobi |
| City Bookshop | CUST-00112 | Mombasa |
| Sunrise Stationers | CUST-00078 | Kisumu |
| National Paper Supplies | CUST-00201 | Nairobi |
| Green Valley Academy | CUST-00155 | Nakuru |

These are used in the sample test inputs below. Adjust names to match your ERPNext Customer master.

---

## 3. Test Roles

| Role | Used For |
|------|----------|
| Sales User (e.g., `salesrep@vimit.com`) | Create reports, run classification, view own records |
| Sales Manager (e.g., `salesmgr@vimit.com`) | Review, approve, submit, view all records |

---

## 4. Core Workflow Tests

### UAT-WF-01: End-to-end happy path — single customer report

**Objective:** Verify the full create → classify → review → approve → submit workflow.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Sales User | Dashboard loads |
| 2 | Go to AI Daily Sales Report > New | Form opens with defaults (today's date, current user, Manual Entry, Not Processed) |
| 3 | Paste in Raw Report Text: `"Visited Metro School. They want 400 dozen A5 exercise books. Waiting for principal's approval. Follow up on Tuesday."` | Text entered |
| 4 | Click Save | Document saved with auto-generated name (AISR-2026-XXXXX) |
| 5 | Click **AI Actions > Classify with AI** | Freeze overlay shows "Classifying with AI..." |
| 6 | Wait for completion | Green or orange alert with summary message |
| 7 | Verify **AI Processing Status** | "Processed" or "Needs Review" |
| 8 | Verify **Primary Customer** | Link set to Metro School (or flagged for review if fuzzy match) |
| 9 | Verify **Primary Report Type** | "Order Opportunity" |
| 10 | Verify **Primary Status** | "Awaiting PO" or "Awaiting Customer Feedback" |
| 11 | Verify **Primary Priority** | "Medium" |
| 12 | Verify **Primary Follow-up Date** | Next Tuesday from report date |
| 13 | Verify **Primary Sentiment** | "Positive" |
| 14 | Verify **Extracted Lines** table | 1 row with matching details |
| 15 | Verify child row `quantity_text` | Contains "400 dozen A5 exercise books" or similar |
| 16 | Verify child row `product_reference_text` | Contains "A5 exercise books" or similar |
| 17 | Log in as Sales Manager | Access report |
| 18 | Review classified fields, correct if needed | Fields editable |
| 19 | Click **AI Actions > Approve** | Review Status = "Approved", Reviewed By populated |
| 20 | Click **Menu > Submit** | Document submitted (docstatus = 1), locked |

---

### UAT-WF-02: Multi-customer report — automatic line splitting

**Objective:** Verify one report with multiple customers creates multiple extracted lines.

**Input text:**
```
Visited Metro School in the morning. They confirmed order for 200 dz A5 books. Delivery next week.
Called City Bookshop after lunch. No interest currently, will revisit in 3 months.
Met Sunrise Stationers. They complained about last delivery being late. Need to escalate.
```

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new report, paste multi-customer text above | Saved |
| 2 | Click Classify with AI | Completes |
| 3 | Verify `contains_multiple_updates` | Checked (1) |
| 4 | Verify `extracted_lines` count | 3 rows |
| 5 | Verify Line 1: Metro School | `report_type` = "Order Opportunity" or "Delivery Follow-up", `status` = "Order Confirmed" or similar |
| 6 | Verify Line 2: City Bookshop | `report_type` = "No Opportunity" or "Visit Update", `status` = "Closed No Opportunity" or similar |
| 7 | Verify Line 3: Sunrise Stationers | `report_type` = "Complaint", `status` = "Complaint Open", `sentiment` = "Negative" |
| 8 | Verify `raw_customer_mentions` field | Contains "Metro School, City Bookshop, Sunrise Stationers" (or short names used in text) |
| 9 | Verify Line 1 has `is_primary_line` = 1 | First line marked as primary |
| 10 | Verify primary summary fields match Line 1 | Customer, report type, status align |

---

### UAT-WF-03: Report with vague/unknown customer name

**Objective:** Verify unmatched customers are flagged for review.

**Input text:**
```
Visited Johnson's place near the market. Interested in bulk notebooks. Wants a quote for 1000 pieces.
```

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify the report | Completes |
| 2 | Verify `customer_match_type` on extracted line | "Unmatched" or "Candidate Only" |
| 3 | Verify `matched_customer` is blank | No customer link set |
| 4 | Verify `needs_review` = 1 on the line | Checked |
| 5 | Verify `review_notes` | Contains note about customer not being resolved |
| 6 | Verify `review_required` on parent | Checked (1) |
| 7 | Verify `ai_processing_status` | "Needs Review" |
| 8 | Verify `review_status` | "Pending Review" |
| 9 | Verify child table row is highlighted yellow | Visual indicator in grid |

---

## 5. Classification Accuracy Tests

### UAT-CLASS-01: Order follow-up note

**Input:**
```
Called National Paper Supplies. Their PO is ready, will send by email today. Expected delivery by end of month.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Order Opportunity" or "Quotation Follow-up" |
| Status | "Awaiting PO" or "Order Confirmed" |
| Priority | "Medium" or "High" |
| Sentiment | "Positive" |
| Action Required | Contains reference to expecting PO by email |
| Product Reference | Empty or "paper supplies" |

---

### UAT-CLASS-02: School visit note

**Input:**
```
Visited Green Valley Academy. Met the bursar. School reopens next month, will need exercise books and registers. Budget not yet approved. Call back in 2 weeks.
```

| Field | Expected Classification |
|-------|------------------------|
| Customer | Green Valley Academy (matched) |
| Report Type | "Visit Update" or "Order Opportunity" |
| Status | "Awaiting Customer Feedback" or "Follow-up Required" |
| Priority | "Medium" |
| Sentiment | "Neutral" |
| Follow-up Date | ~2 weeks from report date |
| Product Reference | Contains "exercise books" and/or "registers" |

---

### UAT-CLASS-03: Complaint from customer

**Input:**
```
Metro School called very angry. The last shipment of A4 paper was damaged. 50 reams unusable. They want replacement or credit immediately. This is urgent.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Complaint" |
| Status | "Complaint Open" |
| Priority | "High" or "Critical" |
| Sentiment | "Negative" |
| Manager Attention Required | true/checked |
| Action Required | Contains reference to replacement or credit note |
| Quantity Text | Contains "50 reams" |
| Product Reference | "A4 paper" |

---

### UAT-CLASS-04: Delivery issue

**Input:**
```
City Bookshop delivery delayed again. Driver couldn't find location. Customer is frustrated. Need to arrange re-delivery tomorrow.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Delivery Follow-up" |
| Status | "Delivery Pending" |
| Priority | "High" |
| Sentiment | "Negative" |
| Action Required | Contains reference to re-delivery |
| Follow-up Date | Tomorrow from report date |

---

### UAT-CLASS-05: Payment / collection discussion

**Input:**
```
Met accounts at Sunrise Stationers regarding outstanding balance of KSH 450,000. They promised payment by end of week via cheque. Follow up Friday.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Payment Follow-up" |
| Status | "Payment Follow-up" |
| Priority | "High" or "Medium" |
| Sentiment | "Neutral" or "Positive" |
| Action Required | Contains reference to follow up on payment |
| Follow-up Date | Next Friday from report date |
| Order Value Text | Contains "KSH 450,000" or "450,000" |

---

### UAT-CLASS-06: Opportunity with vague customer wording

**Input:**
```
Went to that big school on Mombasa Road. Think it's called Greenfield or Greenview. They need 2000 dozen copy books for next term. Very promising.
```

| Field | Expected Classification |
|-------|------------------------|
| Customer Match Type | "Unmatched" or "Candidate Only" |
| Needs Review | Checked |
| Review Notes | Notes about uncertain customer identity |
| Report Type | "Order Opportunity" |
| Status | "New Lead" or "Visited" |
| Sentiment | "Positive" |
| Quantity Text | Contains "2000 dozen copy books" |

---

### UAT-CLASS-07: No-opportunity visit

**Input:**
```
Stopped by National Paper Supplies. They've switched to a different supplier for all exercise books. No chance of getting business back anytime soon.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "No Opportunity" or "Visit Update" |
| Status | "Closed No Opportunity" |
| Priority | "Low" |
| Sentiment | "Negative" |
| Action Required | Empty or minimal |

---

### UAT-CLASS-08: Relationship / courtesy visit

**Input:**
```
Had tea with the owner of City Bookshop. Just maintaining relationship. No specific business discussed. Good rapport.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Relationship Visit" |
| Status | "Visited" |
| Priority | "Low" |
| Sentiment | "Positive" |
| Action Required | Empty or minimal |

---

### UAT-CLASS-09: Quotation follow-up

**Input:**
```
Called Metro School about the quote we sent last week for 500 dz A4 registers. They said still reviewing, decision by Wednesday. Price seems acceptable.
```

| Field | Expected Classification |
|-------|------------------------|
| Report Type | "Quotation Follow-up" |
| Status | "Quote Sent" or "Awaiting Customer Feedback" |
| Priority | "Medium" |
| Sentiment | "Positive" or "Neutral" |
| Follow-up Date | Next Wednesday from report date |
| Quantity Text | "500 dz A4 registers" or similar |
| Product Reference | "A4 registers" |

---

### UAT-CLASS-10: Empty / gibberish text

**Input:**
```
asdf jkl; nothing here
```

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify the report | Completes (does not crash) |
| 2 | Verify `needs_review` | Checked |
| 3 | Verify confidence is low | Below 0.75 |
| 4 | Verify customer is Unmatched | No customer linked |

---

## 6. Customer Matching Tests

### UAT-MATCH-01: Exact customer name match

**Input:** Report text contains the exact `customer_name` from ERPNext (e.g., "Metro School").

| Expected | Result |
|----------|--------|
| `customer_match_type` | "Exact" |
| `customer_match_score` | >= 0.90 |
| `matched_customer` | Linked to correct Customer record |
| `needs_review` | 0 (if score >= high threshold) |

---

### UAT-MATCH-02: Partial / short name match

**Input:** Report text uses "Metro" instead of "Metro School".

| Expected | Result |
|----------|--------|
| `customer_match_type` | "Fuzzy" or "Candidate Only" |
| `customer_match_score` | 0.60–0.89 |
| `matched_customer` | May be linked or blank |
| `needs_review` | 1 |
| `review_notes` | Notes about short name usage |

---

### UAT-MATCH-03: Completely unknown customer

**Input:** Report text mentions "XYZ Trading Co." which does not exist in ERPNext.

| Expected | Result |
|----------|--------|
| `customer_match_type` | "Unmatched" |
| `customer_match_score` | < 0.75 |
| `matched_customer` | Blank |
| `needs_review` | 1 |

---

### UAT-MATCH-04: Multiple customers — each matched independently

**Input:** Report mentions 3 known customers in separate lines.

| Expected | Result |
|----------|--------|
| 3 extracted lines | Each with independent customer matching |
| Each line's `matched_customer` | Correct link (or flagged individually) |
| Lines with low match scores | Flagged independently |

---

## 7. Review Workflow Tests

### UAT-REV-01: Review-required indicator

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report that triggers review (unmatched customer, low confidence) | Status = "Needs Review" |
| 2 | Verify orange "Review Required" badge in form dashboard | Badge visible |
| 3 | Verify child table rows with `needs_review` = 1 are highlighted yellow | Highlighted |

---

### UAT-REV-02: Manager corrects classified fields

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Sales Manager | Access to report |
| 2 | Open a "Needs Review" report | Form loads |
| 3 | Manually set `primary_customer` to correct Customer link | Link field updated |
| 4 | Change `primary_status` from incorrect to correct value | Select field updated |
| 5 | Edit child row: set `matched_customer`, correct `status` | Row updated |
| 6 | Save | Changes saved |
| 7 | Click **AI Actions > Approve** | `review_status` = "Approved", `reviewed_by` = manager, `reviewed_on` = now |

---

### UAT-REV-03: Attempt submit without approval

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify report with `review_required` = 1 | Needs Review |
| 2 | Without approving, click Submit | Error: "This report requires review before submission. Please review and approve first." |

---

### UAT-REV-04: Rerun AI on previously classified report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open a classified report | Status = Processed |
| 2 | Click **AI Actions > Rerun AI** | Confirmation dialog: "This will overwrite the current AI classification. Continue?" |
| 3 | Confirm | Reclassification runs |
| 4 | Verify `processing_attempts` increased | Now equals 2 |
| 5 | Verify child table replaced with new results | New lines present |

---

### UAT-REV-05: Rerun AI on approved report — warning

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open an Approved report | Review Status = Approved |
| 2 | Click **AI Actions > Rerun AI** | Confirmation dialog shown |
| 3 | Confirm | Additional warning: "Reprocessing will overwrite previously reviewed data" |
| 4 | Classification completes | Previous approval cleared, new classification applied |

---

## 8. Form UI / UX Tests

### UAT-UI-01: Form layout and sections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open new AI Daily Sales Report | All sections visible: Report Entry, Raw Intake, AI Processing, Primary Summary (hidden until processed), Action & Follow-up (hidden until processed), Extracted Lines (hidden until processed), Audit (collapsed) |
| 2 | Classify the report | Primary Summary, Action, and Extracted Lines sections appear |
| 3 | Expand Audit section | Request/response payloads, error log, attempts, duration visible |

---

### UAT-UI-02: Button visibility rules

| State | Buttons Visible |
|-------|----------------|
| New (unsaved) | None (no AI Actions group) |
| Saved, Not Processed | Classify with AI |
| Failed | Classify with AI, Rerun AI |
| Processed | Rerun AI, Approve, View Raw AI Response |
| Needs Review | Rerun AI, Approve, View Raw AI Response |
| Approved | Rerun AI, View Raw AI Response |
| Submitted (docstatus=1) | No AI Actions buttons |

---

### UAT-UI-03: Status indicator colors

| AI Processing Status | Indicator Color |
|---------------------|-----------------|
| Not Processed | Grey |
| Processing | Blue |
| Processed | Green |
| Failed | Red |
| Needs Review | Orange |

---

### UAT-UI-04: View Raw AI Response dialog

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On a classified report, click **View Raw AI Response** | Dialog opens (extra-large size) |
| 2 | Verify content | Full JSON response displayed in Code editor with JSON syntax highlighting |
| 3 | Close dialog | Returns to form |

---

### UAT-UI-05: Low confidence warning

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open a report where `ai_confidence_avg` < 0.75 | Form loads |
| 2 | Check dashboard area | Red comment: "Low average confidence (XX%). Results may be unreliable." |

---

### UAT-UI-06: Raw text always visible

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report | Classification complete |
| 2 | Verify Raw Intake section | Still visible, raw text unchanged and readable |
| 3 | Verify `raw_report_text` is not overwritten | Original text preserved |

---

## 9. Submission & Finalization Tests

### UAT-SUB-01: Submit approved report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open an Approved report (review_status = Approved, ai_processing_status = Processed) | Form loads |
| 2 | Click Submit | Blue bar: "Are you sure you want to submit?" |
| 3 | Confirm | Document submitted, locked (blue status bar) |
| 4 | Verify all fields are read-only | No editable fields |

---

### UAT-SUB-02: Amend submitted report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open a submitted report | Docstatus = 1 |
| 2 | Click Amend | New draft created |
| 3 | Verify `amended_from` links to original | Link present |
| 4 | Modify raw text | Text editable |
| 5 | Click Classify with AI | New classification runs on amended text |

---

### UAT-SUB-03: Cannot submit unclassified report

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create and save report, do NOT classify | AI status = Not Processed |
| 2 | Attempt to Submit | Error: "Cannot submit a report that has not been classified. Current AI status: Not Processed" |

---

## 10. Edge Case Tests

### UAT-EDGE-01: Very long report text

**Input:** A block of 2000+ characters covering 10 customer visits.

| Expected | Result |
|----------|--------|
| Classification completes | No timeout (within 30 seconds) |
| Multiple lines extracted | Up to 10 lines |
| No truncation of child rows | All lines present |

---

### UAT-EDGE-02: Report in mixed language

**Input:**
```
Nilikutana na Metro School leo asubuhi. Wanataka A5 books 200 dozen. Very positive meeting. Follow up kesho.
```
(Swahili/English mix, common for Kenyan sales reps)

| Expected | Result |
|----------|--------|
| Classification completes | Does not crash |
| Key data extracted | Customer, quantity, product reference captured |
| Needs review likely flagged | Due to language ambiguity |

---

### UAT-EDGE-03: Report with monetary values

**Input:**
```
Quoted Sunrise Stationers KSH 85 per dozen for A5 exercise books. Total order value approximately KSH 170,000 for 2000 dozen.
```

| Expected | Result |
|----------|--------|
| `order_value_text` | Contains "KSH 170,000" or similar |
| `quantity_text` | Contains "2000 dozen" |
| `product_reference_text` | "A5 exercise books" |

---

### UAT-EDGE-04: Report with no actionable content

**Input:**
```
Rained all day. Couldn't visit anyone. Stayed in office doing paperwork.
```

| Expected | Result |
|----------|--------|
| Customer | Unmatched / blank |
| Report Type | "Other" or "No Opportunity" |
| Status | Reasonable default |
| Action Required | Empty or minimal |
| Confidence | Lower than average |

---

### UAT-EDGE-05: Duplicate classification attempt

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify a report | Status = Processed |
| 2 | Without using "Rerun", call classify again | Error: "This report has already been classified. Use 'Rerun AI' to force reprocessing." |

---

## 11. Acceptance Criteria Checklist

Per the technical specification, the feature is accepted when all criteria below are met:

| # | Criterion | Test Reference | Pass |
|---|-----------|---------------|------|
| 1 | User can create an AI Daily Sales Report in ERPNext | UAT-WF-01 step 2-4 | [ ] |
| 2 | User can paste free-text report | UAT-WF-01 step 3 | [ ] |
| 3 | User can click Classify with AI | UAT-WF-01 step 5 | [ ] |
| 4 | System stores AI result in structured fields | UAT-WF-01 steps 7-16 | [ ] |
| 5 | Customer is matched or flagged correctly | UAT-MATCH-01 through 04 | [ ] |
| 6 | Invalid or uncertain outputs are marked for review | UAT-WF-03, UAT-CLASS-10 | [ ] |
| 7 | Reviewer can amend and approve | UAT-REV-02 | [ ] |
| 8 | All processing is logged | OAT-AUD-01 through 05 | [ ] |
| 9 | No OpenAI key is exposed in the browser | OAT-SEC-04 | [ ] |
| 10 | No uncontrolled status values are saved | OAT-DATA-01 | [ ] |

---

## 12. Sign-Off

| Role | Name | Date | Result |
|------|------|------|--------|
| Sales User (Tester) | | | Pass / Fail |
| Sales Manager (Reviewer) | | | Pass / Fail |
| Product Owner | | | Pass / Fail |
| QA Lead | | | Pass / Fail |
