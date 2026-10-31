# 6. Subscriptions

The contract between Brightloop and a customer, and the record that drives billing.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Create from a quotation template or from scratch | ✅ | |
| Unique numbers | ✅ | Such as `SUB-000001` |
| Start and expiry dates | ✅ | Expiry is optional |
| Payment terms | ✅ | Days until an invoice is due |
| Line items | ✅ | Product, quantity, unit price, taxes, amount |
| Change quantities and prices | 🟡 | API only, and drafts only |
| Status tracking | ✅ | Progress bar on each subscription |
| Pause, resume, renew, close | ✅ | Where the plan allows |

## Lifecycle

```
Draft → Quotation → Confirmed → Active → Closed
                                  ↕
                                Paused
```

| Status | Meaning | Next |
| --- | --- | --- |
| Draft | Being prepared; hidden from the customer | Quotation, Closed |
| Quotation | Sent; waiting for a decision | Confirmed, Closed |
| Confirmed | Accepted; not billing yet | Active, Closed |
| Active | Billing | Paused, Closed |
| Paused | Not billing | Active, Closed |
| Closed | Finished; can't be reopened | None |

The server refuses any other change. If two people act at once, the second gets a message to reload.

**Renewed and Expired** aren't separate statuses:
- **Renewing** extends the expiry date of an Active or Paused subscription, which stays as it is. Without a chosen date, it extends by the original term.
- **Expiring** on a plan that closes on its own produces Closed with the reason "Expired". On other plans, billing stops and the subscription stays Active until someone renews or closes it.

## Rules

**Pausing:** periods that start during a pause aren't billed. Anything already due before the pause still is.

**Activating** bills the first period at once if the start date has arrived. If the start date is further back, the worker catches up on the remaining periods.

**Expiry** must be after the start date. On a plan that closes on its own, it can't be later than the plan's end date.

## Screens

Subscriptions: list with status filter and number search. New subscription. Subscription detail: status, lines, discounts, invoices and actions.

## API

`GET|POST /subscriptions`, `POST /subscriptions/from-template`, `GET|PUT /subscriptions/:id`, and `POST /subscriptions/:id/` followed by `send`, `confirm`, `activate`, `pause`, `resume`, `renew` or `close`
