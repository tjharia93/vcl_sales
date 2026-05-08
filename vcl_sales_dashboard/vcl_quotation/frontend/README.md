# VCL Quotation — React/Vite frontend

This is the source for the VCL Quotation SPA served at **`/quotation`** by the
`vcl_sales_dashboard` Frappe app. It replaces the Phase 1 Express + lowdb
local stack documented in the
[VCL Quotation Developer Notes](https://www.notion.so/VCL-Quotation-System-Developer-Notes-35a8e0265cd581e2bb9bf758ba248a67).

## Layout

```
vcl_sales_dashboard/vcl_quotation/
├── api.py                     # whitelisted Frappe methods (replaces Express)
├── doctype/
│   ├── vcl_costing_settings/  # Single DocType — rates / PIN / margins
│   ├── vcl_quotation/         # main submittable DocType
│   └── vcl_quote_cost_row/    # child table — cost breakdown rows
└── frontend/                  # ← this folder (Vite source)
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/quotes.js      # frappe.call wrappers
        ├── context/CostingContext.jsx
        └── ...
```

The build emits directly into `vcl_sales_dashboard/www/quotation/` so
`bench build` / `git commit` picks up the asset bundle alongside the page
controller (`www/quotation/index.py`).

## Build & deploy

```bash
cd vcl_sales_dashboard/vcl_quotation/frontend
npm install
npm run build      # writes ../../www/quotation/{index.html,assets/}
```

Commit the resulting `www/quotation/index.html` + `www/quotation/assets/`
along with any source changes, push, then deploy on Frappe Cloud as usual.

## Local dev against a Frappe bench

```bash
FRAPPE_DEV_URL=http://localhost:8000 npm run dev
```

The Vite proxy forwards `/api` and `/assets` to the local bench so
`frappe.call` and CSRF cookies work the same way they do in production.
Without `FRAPPE_DEV_URL` the dev server runs standalone — API calls will
fail until the page is opened from a real Frappe site.

## API surface

All calls hit `vcl_sales_dashboard.vcl_quotation.api.<method>`:

| Frontend helper           | Whitelisted method            | Method type |
|---------------------------|-------------------------------|-------------|
| `apiNextRef()`            | `next_ref`                    | GET         |
| `apiGetQuotes()`          | `get_quote_list`              | GET         |
| `apiGetQuote(id)`         | `get_quote`                   | GET         |
| `apiSaveQuote(form)`      | `save_quote`                  | POST        |
| `apiUpdateStatus(id,s)`   | `update_quote_status`         | POST        |
| `apiGetCostingSettings()` | `get_costing_settings`        | GET         |
| `apiUpdateCostingSettings(rates)` | `update_costing_settings` | POST    |
