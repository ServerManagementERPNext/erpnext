// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

// js inside blog page

// shopping cart
frappe.provide("erpnext.e_commerce.shopping_cart");
var shopping_cart = erpnext.e_commerce.shopping_cart;

$.extend(shopping_cart, {
	show_error: function(title, text) {
		$("#cart-container").html('<div class="msg-box"><h4>' +
			title + '</h4><p class="text-muted">' + text + '</p></div>');
	},

	bind_events: function() {
		shopping_cart.bind_address_picker_dialog();
		shopping_cart.bind_place_order();
		shopping_cart.bind_request_quotation();
		shopping_cart.bind_change_qty();
		shopping_cart.bind_remove_cart_item();
		shopping_cart.bind_change_notes();
		shopping_cart.bind_change_deployment_name();
		shopping_cart.bind_coupon_code();
	},

	bind_address_picker_dialog: function() {
		const d = this.get_update_address_dialog();
		$(shopping_cart.parent).on("click", ".btn-change-address", (e) => {
			const type = $(e.currentTarget).parents('.address-container').attr('data-address-type');
			$(d.get_field('address_picker').wrapper).html(
				this.get_address_template(type)
			);
			d.show();
		});
	},

	get_update_address_dialog() {
		let d = new frappe.ui.Dialog({
			title: "Select Address",
			fields: [{
				'fieldtype': 'HTML',
				'fieldname': 'address_picker',
			}],
			primary_action_label: __('Set Address'),
			primary_action: () => {
				const $card = d.$wrapper.find('.address-card.active');
				const address_type = $card.closest('[data-address-type]').attr('data-address-type');
				const address_name = $card.closest('[data-address-name]').attr('data-address-name');
				frappe.call({
					type: "POST",
					method: "erpnext.e_commerce.shopping_cart.cart.update_cart_address",
					freeze: true,
					args: {
						address_type,
						address_name
					},
					callback: function(r) {
						d.hide();
						if (!r.exc) {
							$(".cart-tax-items").html(r.message.total);
							shopping_cart.parent.find(
								`.address-container[data-address-type="${address_type}"]`
							).html(r.message.address);
						}
					}
				});
			}
		});

		return d;
	},

	get_address_template(type) {
		return {
			shipping: `<div class="mb-3" data-section="shipping-address">
				<div class="row no-gutters" data-fieldname="shipping_address_name">
					{% for address in shipping_addresses %}
						<div class="mr-3 mb-3 w-100" data-address-name="{{address.name}}" data-address-type="shipping"
							{% if doc.shipping_address_name == address.name %} data-active {% endif %}>
							{% include "templates/includes/cart/address_picker_card.html" %}
						</div>
					{% endfor %}
				</div>
			</div>`,
			billing: `<div class="mb-3" data-section="billing-address">
				<div class="row no-gutters" data-fieldname="customer_address">
					{% for address in billing_addresses %}
						<div class="mr-3 mb-3 w-100" data-address-name="{{address.name}}" data-address-type="billing"
							{% if doc.shipping_address_name == address.name %} data-active {% endif %}>
							{% include "templates/includes/cart/address_picker_card.html" %}
						</div>
					{% endfor %}
				</div>
			</div>`,
		}[type];
	},

	bind_place_order: function() {
		$(shopping_cart.parent).on("click", ".btn-place-order", function() {
			shopping_cart.place_order(this);
		});
	},

	bind_request_quotation: function() {
		$(shopping_cart.parent).on("click", ".btn-request-for-quotation", function() {
			shopping_cart.request_quotation(this);
		});
	},

	bind_change_qty: function() {
		// bind update button
		$(".cart-items").on("change", ".cart-qty", function() {
			var item_code = $(this).attr("data-item-code");
			var newVal = cint($(this).val());
			var uom = $(this).attr("data-uom");
			var deployment_name = $(this).attr("data-deployment-name");
			var notes = $(this).attr("data-notes").trim();

			newVal = shopping_cart.validate_cart_qty(newVal);
			$(this).val(newVal);
			shopping_cart.shopping_cart_update({
				item_code,
				qty: newVal,
				uom,
				deployment_name,
				additional_notes: notes
			});
		});

		$(".cart-items").on('click', '.number-spinner button', function () {
			var btn = $(this),
				input = btn.closest('.number-spinner').find('input'),
				oldValue = input.val().trim(),
				newVal = 0;

			if (btn.attr('data-dir') == 'up') {
				newVal = parseInt(oldValue) + 1;
			} else {
				if (oldValue > 1) {
					newVal = parseInt(oldValue) - 1;
				}
			}
			newVal = shopping_cart.validate_cart_qty(newVal);
			input.val(newVal);

			var notes = input.attr("data-notes").trim();
			var item_code = input.attr("data-item-code");
			var uom = input.attr("data-uom");
			var deployment_name = input.attr("data-deployment-name");
			shopping_cart.shopping_cart_update({
				item_code,
				qty: newVal,
				uom,
				deployment_name,
				additional_notes: notes
			});
		});
	},

	bind_change_notes: function() {
		$('.cart-items').on('change', '.cart-item-notes', function() {
			const $textarea = $(this);
			const item_code = $textarea.attr('data-item-code');
			const qty = $textarea.closest('tr').find('.cart-qty').val();
			const uom = $textarea.attr("data-uom");
			const deployment_name = $textarea.attr("data-deployment-name");
			const notes = $textarea.val();
			shopping_cart.shopping_cart_update({
				item_code,
				qty,
				uom,
				deployment_name,
				additional_notes: notes
			});
		});
	},

	bind_change_deployment_name: function() {
		$('.cart-items').on('change', '.cart-deployment-name', function() {

			const $deployment_name_input = $(this);
			const row_name = $deployment_name_input.closest('tr').attr('data-name');
			const old_deployment_name = $deployment_name_input.attr('data-deployment-name');
			const deployment_name = $deployment_name_input.val().trim();
			if (!deployment_name && old_deployment_name) {
				$deployment_name_input.val(old_deployment_name);
				frappe.throw(__('Deployment Name is mandatory'))
			}

			if (old_deployment_name != deployment_name) {
				shopping_cart.freeze();
				frappe.call({
					type: "POST",
					method: "erpnext.e_commerce.shopping_cart.cart.update_cart_deployment_name",
					args: {
						row_name,
						deployment_name
					},
					callback: function (r) {
						if(!r.exc) {
							$(".cart-items").html(r.message.items);
						}
					},
					always: function() {
						shopping_cart.unfreeze();
					}
				});
			}
		});
	},

	bind_remove_cart_item: function() {
		$(".cart-items").on("click", ".remove-cart-item", (e) => {
			const $remove_cart_item_btn = $(e.currentTarget);
			var item_code = $remove_cart_item_btn.data("item-code");
			var uom = $remove_cart_item_btn.attr("data-uom");
			var deployment_name = $remove_cart_item_btn.attr("data-deployment-name");
			shopping_cart.shopping_cart_update({
				item_code: item_code,
				qty: 0,
				uom,
				deployment_name
			});
		});
	},

	render_tax_row: function($cart_taxes, doc, shipping_rules) {
		var shipping_selector;
		if(shipping_rules) {
			shipping_selector = '<select class="form-control">' + $.map(shipping_rules, function(rule) {
				return '<option value="' + rule[0] + '">' + rule[1] + '</option>' }).join("\n") +
			'</select>';
		}

		var $tax_row = $(repl('<div class="row">\
			<div class="col-md-9 col-sm-9">\
				<div class="row">\
					<div class="col-md-9 col-md-offset-3">' +
					(shipping_selector || '<p>%(description)s</p>') +
					'</div>\
				</div>\
			</div>\
			<div class="col-md-3 col-sm-3 text-right">\
				<p' + (shipping_selector ? ' style="margin-top: 5px;"' : "") + '>%(formatted_tax_amount)s</p>\
			</div>\
		</div>', doc)).appendTo($cart_taxes);

		if(shipping_selector) {
			$tax_row.find('select option').each(function(i, opt) {
				if($(opt).html() == doc.description) {
					$(opt).attr("selected", "selected");
				}
			});
			$tax_row.find('select').on("change", function() {
				shopping_cart.apply_shipping_rule($(this).val(), this);
			});
		}
	},

	validate_cart_qty: function(qty) {
		if (qty < 0) {
			qty = qty * -1;
		}
		else if (qty == 0) {
			qty = 1;
		}
		if (qty > 10) {
			frappe.msgprint(__("Cart limit is 10"));
			qty = 10;
		}
		return qty
	},

	apply_shipping_rule: function(rule, btn) {
		return frappe.call({
			btn: btn,
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.apply_shipping_rule",
			args: { shipping_rule: rule },
			callback: function(r) {
				if(!r.exc) {
					shopping_cart.render(r.message);
				}
			}
		});
	},

	place_order: function(btn) {
		shopping_cart.freeze();

		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.place_order",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					window.location.href = '/orders/' + encodeURIComponent(r.message);
				}
			},
			always: function() {
				shopping_cart.unfreeze();
			}
		});
	},

	request_quotation: function(btn) {
		shopping_cart.freeze();

		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.request_for_quotation",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					shopping_cart.unfreeze();
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					window.location.href = '/quotations/' + encodeURIComponent(r.message);
				}
			}
		});
	},

	bind_coupon_code: function() {
		$(shopping_cart.parent).on("click", ".bt-coupon", function() {
			shopping_cart.apply_coupon_code(this);
		});
	},

	apply_coupon_code: function(btn) {
		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.apply_coupon_code",
			btn: btn,
			args : {
				applied_code : $('.txtcoupon').val(),
				applied_referral_sales_partner: $('.txtreferral_sales_partner').val()
			},
			callback: function(r) {
				if (r && r.message){
					location.reload();
				}
			}
		});
	}
});

frappe.ready(function() {
//	$(".cart-icon").hide();
	shopping_cart.parent = $(".cart-container");
	shopping_cart.bind_events();
});

function show_terms() {
	var html = $(".cart-terms").html();
	frappe.msgprint(html);
}
