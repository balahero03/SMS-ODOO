# 8. Discounts

Price reductions that appear on invoices by themselves and stop by themselves.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Fixed-amount discounts | ✅ | Admin only |
| Percentage discounts | ✅ | Up to 100% |
| Minimum purchase amount | ✅ | |
| Minimum quantity | ✅ | |
| Validity dates | ✅ | |
| Usage limits | ✅ | Optional |
| Specific products | ✅ | |
| Whole subscriptions | ✅ | When no product is selected |
| Applied automatically during billing | ✅ | Once attached to a subscription |
| Stops when expired or used up | ✅ | |

## How it works

1. The admin creates the rule.
2. The admin or staff attach it to a subscription.
3. Each billing run checks it, and if it qualifies it appears on the invoice with no further action.

## Rules

A discount applies to an invoice only if all of these are true:
- The billing period's start date is within the discount's dates.
- The lines it covers meet the minimum purchase and quantity.
- It has uses left.

**Usage:** each invoice counts as one use. The limit holds even when many subscriptions bill at the same moment. Cancelling an invoice gives its use back.

**Calculation:** discounts come off before tax. Several discounts apply in the order they were attached, and a line can't go below zero. A fixed amount is shared across the covered lines in proportion, to the exact paisa.

**On the invoice:** each discount is listed by name with its amount.

## Screens

Discounts: list with usage, and add discount. Subscription detail: apply or remove.

## API

`GET|POST /discounts`, `PATCH /discounts/:id`, `POST /subscriptions/:id/discounts`, `DELETE /subscriptions/:id/discounts/:discountId`
