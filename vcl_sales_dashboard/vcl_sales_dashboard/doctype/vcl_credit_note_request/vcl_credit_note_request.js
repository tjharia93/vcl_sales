frappe.ui.form.on("VCL Credit Note Request", {
    refresh(frm) {
        if (frm.doc.status === "Approved" && !frm.doc.linked_credit_note) {
            frm.add_custom_button(__("Create Credit Note"), () => {
                frappe.call({
                    method: "vcl_sales_dashboard.vcl_sales_dashboard.doctype.vcl_credit_note_request.vcl_credit_note_request.create_credit_note",
                    args: { cn_request: frm.doc.name },
                    freeze: true,
                    freeze_message: __("Creating Credit Note..."),
                }).then((r) => {
                    if (r && r.message && r.message.route) {
                        frappe.set_route(r.message.route.replace("/app/", "").split("/"));
                    }
                });
            }, __("Actions"));
        }
        if (frm.doc.linked_credit_note) {
            frm.add_custom_button(
                __("Open Credit Note"),
                () => frappe.set_route("Form", "Sales Invoice", frm.doc.linked_credit_note),
                __("Actions"),
            );
        }
    },
});


function recalc_row(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    row.supplied_amount = flt(row.supplied_qty) * flt(row.supplied_unit_price);
    row.correct_amount = flt(row.correct_qty) * flt(row.correct_unit_price);
    row.difference = flt(row.supplied_amount) - flt(row.correct_amount);
    frm.refresh_field("line_items");
    recalc_totals(frm);
}


function recalc_totals(frm) {
    let supplied = 0;
    let correct = 0;
    (frm.doc.line_items || []).forEach((r) => {
        supplied += flt(r.supplied_amount);
        correct += flt(r.correct_amount);
    });
    const diff = supplied - correct;
    const vat = diff * 0.16;
    frm.set_value("subtotal_supplied", supplied);
    frm.set_value("subtotal_correct", correct);
    frm.set_value("vat_amount", vat);
    frm.set_value("total_credit", diff + vat);
}


frappe.ui.form.on("VCL CN Line Item", {
    supplied_qty: recalc_row,
    supplied_unit_price: recalc_row,
    correct_qty: recalc_row,
    correct_unit_price: recalc_row,
    line_items_remove: recalc_totals,
});
