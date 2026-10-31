# 5. Quotations

Lets a sales rep start from a ready-made offer instead of building one from scratch.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Quotation templates | ✅ | Created and deleted by the admin |
| Products and plan on a template | ✅ | One plan, one or more lines, optional variants |
| Validity period | ✅ | Days, set on the template |
| Generate a quotation for a customer | ✅ | From a template or from scratch |
| Convert to a subscription | ✅ | |
| Track status | ✅ | |

## How it works

A quotation isn't a separate record. It's a subscription at an early status, so nothing has to be copied across when it's accepted.

1. Staff choose a template and a customer, which creates a **Draft**.
2. **Send** moves it to **Quotation**, starts the validity period and emails the customer.
3. The customer or the team confirms it, moving it to **Confirmed**.
4. The team activates it, moving it to **Active**. Billing starts.

## Rules

**Validity:** the period starts when the quotation is sent. An expired quotation can't be confirmed.

**Prices** come from the current product and variant when the subscription is created. Changing the template later doesn't affect it.

**Drafts** are hidden from customers until sent.

## Screens

Quotation templates: list, add and delete. New subscription: choose From template or From scratch.

## API

`GET|POST /templates`, `DELETE /templates/:id`, `POST /subscriptions/from-template`, `POST /subscriptions/:id/send`, `POST /subscriptions/:id/confirm`
