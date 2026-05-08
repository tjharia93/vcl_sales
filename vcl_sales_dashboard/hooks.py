app_name = "vcl_sales_dashboard"
app_title = "VCL Sales Dashboard"
app_publisher = "Vimit Converters Limited"
app_description = "Sales dashboard for VCL sales team"
app_email = "info@vimitconverters.com"
app_license = "MIT"

# Website pages served from www/
website_route_rules = [
    {"from_route": "/sales-dashboard", "to_route": "sales-dashboard"},
    {"from_route": "/sales-discrepancy", "to_route": "sales-discrepancy"},
    {"from_route": "/sales-customer/<name>", "to_route": "sales-customer"},
    {"from_route": "/sales-manager", "to_route": "sales-manager"},
    {"from_route": "/sales-collections", "to_route": "sales-collections"},
    {"from_route": "/sales-collections-submission", "to_route": "sales-collections-submission"},
    # VCL Quotation SPA — React/Vite build under www/quotation/
    {"from_route": "/quotation", "to_route": "quotation/index"},
]

# DocType fixtures
fixtures = [
    {
        "dt": "Custom DocPerm",
        "filters": [["parent", "in", ["AI Daily Sales Report"]]],
    },
    # VCL Quotation system — ship the three module DocTypes via fixtures so
    # they land on Frappe Cloud through `bench migrate` without a manual
    # console step.
    {
        "dt": "DocType",
        "filters": [["name", "in", [
            "VCL Costing Settings",
            "VCL Quotation",
            "VCL Quote Cost Row",
        ]]],
    },
]
