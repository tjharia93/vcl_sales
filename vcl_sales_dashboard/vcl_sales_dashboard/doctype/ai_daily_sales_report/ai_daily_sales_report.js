frappe.ui.form.on("AI Daily Sales Report", {
	refresh: function (frm) {
		// Status indicator colors
		_set_status_indicator(frm);

		// Only show buttons on saved, non-submitted drafts
		if (frm.doc.docstatus === 0 && !frm.is_new()) {
			_add_classify_button(frm);
			_add_rerun_button(frm);
			_add_approve_button(frm);
			_add_view_response_button(frm);
		}

		// Highlight review-required rows in child table
		_highlight_review_rows(frm);
	},
});

function _add_classify_button(frm) {
	if (frm.doc.ai_processing_status === "Not Processed" || frm.doc.ai_processing_status === "Failed") {
		frm.add_custom_button(__("Classify with AI"), function () {
			_run_classification(frm, 0);
		}, __("AI Actions"));
	}
}

function _add_rerun_button(frm) {
	if (frm.doc.ai_processing_status === "Processed" || frm.doc.ai_processing_status === "Needs Review" || frm.doc.ai_processing_status === "Failed") {
		frm.add_custom_button(__("Rerun AI"), function () {
			frappe.confirm(
				__("This will overwrite the current AI classification. Continue?"),
				function () {
					_run_classification(frm, 1);
				}
			);
		}, __("AI Actions"));
	}
}

function _add_approve_button(frm) {
	if (
		(frm.doc.ai_processing_status === "Processed" || frm.doc.ai_processing_status === "Needs Review") &&
		frm.doc.review_status !== "Approved"
	) {
		frm.add_custom_button(__("Approve"), function () {
			frappe.call({
				method: "vcl_sales_dashboard.api.sales_report_ai.approve_ai_report",
				args: { docname: frm.doc.name },
				freeze: true,
				freeze_message: __("Approving..."),
				callback: function (r) {
					if (r.message && r.message.success) {
						frappe.show_alert({
							message: r.message.message,
							indicator: "green",
						});
						frm.reload_doc();
					}
				},
			});
		}, __("AI Actions"));
	}
}

function _add_view_response_button(frm) {
	if (frm.doc.ai_response_payload) {
		frm.add_custom_button(__("View Raw AI Response"), function () {
			let d = new frappe.ui.Dialog({
				title: __("Raw AI Response"),
				size: "extra-large",
				fields: [
					{
						fieldtype: "Code",
						fieldname: "response",
						options: "JSON",
						read_only: 1,
						default: frm.doc.ai_response_payload,
					},
				],
			});
			d.show();
		}, __("AI Actions"));
	}
}

function _run_classification(frm, force_reprocess) {
	if (!frm.doc.raw_report_text || !frm.doc.raw_report_text.trim()) {
		frappe.msgprint(__("Please enter the raw report text before classifying."));
		return;
	}

	frm.save().then(function () {
		frappe.call({
			method: "vcl_sales_dashboard.api.sales_report_ai.classify_sales_report",
			args: {
				docname: frm.doc.name,
				force_reprocess: force_reprocess,
			},
			freeze: true,
			freeze_message: __("Classifying with AI... This may take a few seconds."),
			callback: function (r) {
				if (r.message && r.message.success) {
					frappe.show_alert({
						message: r.message.message,
						indicator: r.message.review_required ? "orange" : "green",
					});
					frm.reload_doc();
				}
			},
			error: function () {
				frm.reload_doc();
			},
		});
	});
}

function _set_status_indicator(frm) {
	let status = frm.doc.ai_processing_status;
	let color = {
		"Not Processed": "grey",
		"Queued": "blue",
		"Processing": "blue",
		"Processed": "green",
		"Failed": "red",
		"Needs Review": "orange",
	}[status] || "grey";

	frm.page.set_indicator(status, color);

	// Additional badge for review status
	if (frm.doc.review_status === "Approved") {
		frm.dashboard.set_headline(
			__('<span class="indicator-pill green">' +
				'<span class="indicator green"></span> Approved by {0}</span>',
				[frm.doc.reviewed_by])
		);
	} else if (frm.doc.review_required) {
		frm.dashboard.set_headline(
			__('<span class="indicator-pill orange">' +
				'<span class="indicator orange"></span> Review Required</span>')
		);
	}

	// Confidence warning
	if (frm.doc.ai_confidence_avg && frm.doc.ai_confidence_avg < 0.75) {
		frm.dashboard.add_comment(
			__("Low average confidence ({0}%). Results may be unreliable.",
				[Math.round(frm.doc.ai_confidence_avg * 100)]),
			"red",
			true
		);
	}
}

function _highlight_review_rows(frm) {
	if (!frm.fields_dict.extracted_lines || !frm.fields_dict.extracted_lines.grid) {
		return;
	}
	let grid = frm.fields_dict.extracted_lines.grid;
	grid.grid_rows.forEach(function (row) {
		if (row.doc.needs_review) {
			$(row.row).css("background-color", "#fff3cd");
		}
		if (row.doc.customer_match_type === "Unmatched") {
			$(row.row).find('[data-fieldname="matched_customer"]').css("color", "#dc3545");
		}
	});
}
