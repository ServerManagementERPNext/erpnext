# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import date_diff, flt, get_first_day, get_last_day, getdate, cint, add_days
from dateutil.relativedelta import relativedelta

from erpnext.utilities.product import get_price


class SubscriptionPlan(Document):
	def validate(self):
		self.validate_interval_count()

	def validate_interval_count(self):
		if cint(self.billing_interval_count) < 1:
			frappe.throw(_("Billing Interval Count cannot be less than 1"))


@frappe.whitelist()
def get_plan_rate(
	plan, quantity=1, customer=None, start_date=None, end_date=None, prorate_factor=1
):
	plan = frappe.get_doc("Subscription Plan", plan)
	if plan.price_determination == "Fixed Rate":
		return plan.cost * prorate_factor

	elif plan.price_determination == "Based On Price List":
		if customer:
			customer_group = frappe.db.get_value("Customer", customer, "customer_group")
		else:
			customer_group = None

		price = get_price(
			item_code=plan.item,
			price_list=plan.price_list,
			customer_group=customer_group,
			company=None,
			qty=quantity,
		)
		if not price:
			return 0
		else:
			return price.price_list_rate * prorate_factor

	elif plan.price_determination == "Monthly Rate":
		start_date = getdate(start_date)
		end_date = getdate(end_date)

		rd = relativedelta(add_days(end_date, 1), start_date)
		no_of_months = rd.months + rd.years * 12
		no_of_days = rd.days

		cost = plan.cost * no_of_months

		# Adjust cost if start or end date is not month start or end
		prorate = frappe.db.get_single_value("Subscription Settings", "prorate")
		if prorate and no_of_days:
			days_in_start_month = date_diff(get_last_day(start_date), get_first_day(start_date)) + 1
			days_in_end_month = date_diff(get_last_day(start_date), get_first_day(start_date)) + 1
			avg_days_in_month = (days_in_start_month + days_in_end_month) / 2

			cost += plan.cost * no_of_days / avg_days_in_month

		return cost
