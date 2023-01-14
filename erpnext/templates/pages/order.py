# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt


import frappe
from frappe import _

from erpnext.e_commerce.doctype.e_commerce_settings.e_commerce_settings import show_attachments


def get_context(context):
	context.no_cache = 1
	context.show_sidebar = True
	context.doc = frappe.get_doc(frappe.form_dict.doctype, frappe.form_dict.name)
	if hasattr(context.doc, "set_indicator"):
		context.doc.set_indicator()

	if show_attachments():
		context.attachments = get_attachments(frappe.form_dict.doctype, frappe.form_dict.name)

	context.parents = frappe.form_dict.parents
	context.title = frappe.form_dict.name
	context.payment_ref = frappe.db.get_value(
		"Payment Request", {"reference_name": frappe.form_dict.name}, "name"
	)

	context.enabled_checkout = frappe.get_doc("E Commerce Settings").enable_checkout

	default_print_format = frappe.db.get_value(
		"Property Setter",
		dict(property="default_print_format", doc_type=frappe.form_dict.doctype),
		"value",
	)
	if default_print_format:
		context.print_format = default_print_format
	else:
		context.print_format = "Standard"

	if not frappe.has_website_permission(context.doc):
		frappe.throw(_("Not Permitted"), frappe.PermissionError)

	# check for the loyalty program of the customer
	customer_loyalty_program = frappe.db.get_value(
		"Customer", context.doc.customer, "loyalty_program"
	)
	if customer_loyalty_program:
		from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
			get_loyalty_program_details_with_points,
		)

		loyalty_program_details = get_loyalty_program_details_with_points(
			context.doc.customer, customer_loyalty_program
		)
		context.available_loyalty_points = int(loyalty_program_details.get("loyalty_points"))

	# show Make Purchase Invoice button based on permission
	context.show_make_pi_button = frappe.has_permission("Purchase Invoice", "create")

	for d in context.doc.get("items"):
		set_image_from_item(d)


def get_attachments(dt, dn):
	return frappe.get_all(
		"File",
		fields=["name", "file_name", "file_url", "is_private"],
		filters={"attached_to_name": dn, "attached_to_doctype": dt, "is_private": 0},
	)


def set_image_from_item(doc):
	variant_item_code = doc.item_code
	template_item_code = frappe.get_cached_value("Item", variant_item_code, 'variant_of')

	doc.image = get_image_from_website_item(variant_item_code) or get_image_from_website_item(template_item_code)
	if doc.image:
		return

	doc.image = frappe.get_cached_value("Item", variant_item_code, "image")
	if doc.image:
		return

	if template_item_code:
		doc.image = frappe.get_cached_value("Item", template_item_code, "image")


def get_image_from_website_item(item_code):
	if not item_code:
		return None

	website_item = frappe.db.get_value("Website Item", {"item_code": item_code}, ["thumbnail", "image"], as_dict=True)
	if website_item:
		return website_item.get("thumbnail") or website_item.get("image")
