# 10. Customer portal

Lets customers see and manage their subscriptions without having to email anyone.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Customer login | ✅ | |
| Subscription details | ✅ | |
| Active and closed subscriptions | ✅ | Filter by status |
| Plan details | 🟡 | The plan on each subscription; no plan catalogue |
| Invoices | ✅ | Confirmed onward; never drafts |
| Download invoice PDFs | 🟡 | Through the browser's print dialog |
| Payment history | 🟡 | Shown on each invoice; no combined list |
| Confirm quotations | ✅ | |
| Renew, pause and resume | ✅ | Where the plan allows |
| Close a subscription | ✅ | Closes at once where the plan allows, rather than sending a request |
| Buy a new subscription online | ⬜ | The team creates subscriptions |
| Pay online | ⬜ | See [payments](09-payments.md) |

## What customers are restricted from

- **Other customers' records:** every query is limited to the signed-in customer. Asking for someone else's record returns "not found", which doesn't reveal that it exists.
- **Unsent work:** draft subscriptions and draft invoices.
- **Internal data:** the catalogue, cost prices, other customers, the payments list and the dashboard. These requests return "forbidden".
- **Team actions:** they can't record payments, confirm invoices or attach discounts.

These limits are enforced on the server, not just by hiding menu items.

## Screens

My subscriptions, subscription detail, My invoices and invoice detail.

## API

Customers use the same routes as the team and get results limited to their own records: `GET /subscriptions`, `GET /subscriptions/:id`, `GET /invoices`, `GET /invoices/:id`, and `POST /subscriptions/:id/` followed by `confirm`, `pause`, `resume`, `renew` or `close`.
