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
]
