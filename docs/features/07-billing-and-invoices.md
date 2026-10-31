# 7. Billing and invoices

Creates invoices from subscriptions so nobody types them by hand. The [billing workflow](../billing-workflow.md) has the technical detail.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Scheduled recurring billing | ✅ | Hourly worker, plus a manual run for the admin |
| Invoice generation from subscriptions | ✅ | Customer details, lines, taxes and totals filled in |
| Nothing billed twice or skipped | ✅ | Including catch-up after downtime |
| Automatic tax calculation | ✅ | From the admin's rules |
| Subtotal, discount, tax and total | ✅ | |
| Confirm | ✅ | One at a time, or all drafts at once |
| Cancel | ✅ | Only if nothing has been paid |
| Send by email | ✅ | Sent when the team selects Send |
| Print | ✅ | Print layout hides the app's menus and buttons |
| PDF | 🟡 | Through the browser's print dialog; no generated file |
| Status tracking | ✅ | |

## Invoice lifecycle

```
Draft → Confirmed → Paid
  └────────┴──→ Cancelled
```

**Overdue** is worked out, not stored: a confirmed invoice past its due date. Customers see invoices only from Confirmed onward.

## How an invoice is calculated

```
line gross = quantity × unit price
taxable    = line gross − line discount
line tax   = taxable × tax rate, rounded to the paisa
total      = subtotal − discounts + tax
```

Example: 2 seats at ₹1,000 with 10% off and 18% tax gives ₹2,000 − ₹200 + ₹324 = **₹2,124**.

## Tax

The admin creates rules with a rate and, optionally, a product type. Every active rule that matches a line is added together. A rule with no type applies to everything, including the plan fee. Rule changes affect future invoices only.

## Rules

**Due date:** the billing date plus the subscription's payment terms.

**Billing dates** are worked out from the start date, so a subscription starting on 31 January bills on 28 February and then 31 March.

**Invoices keep their own copy** of prices, taxes and customer details, so they never change afterwards.

**Cancelling** doesn't lead to a new bill for that period, and gives back any discount use.

**Zero-total invoices** go straight to Paid when confirmed.

## Screens

Invoices: list with status filter and number search, plus Confirm all drafts. Invoice detail: lines, totals, payments, and Confirm, Send, Print and Cancel. Taxes: rules. Dashboard: Billing run.

## API

`POST /billing/run`, `GET /invoices`, `GET /invoices/:id`, `POST /invoices/confirm-drafts`, `POST /invoices/:id/confirm`, `/cancel`, `/send`, `GET|POST /taxes`, `PATCH /taxes/:id`
