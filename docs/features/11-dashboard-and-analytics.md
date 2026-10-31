# 11. Dashboard and analytics

One place for the finance lead's end-of-month questions: how many subscriptions are active, how much came in, how much is owed and what's overdue.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Active subscriptions | ✅ | With the number expiring within 30 days |
| Revenue collected | ✅ | With the number of payments |
| Outstanding payments | ✅ | |
| Overdue invoices | ✅ | Total, count and oldest ten |
| Monthly recurring revenue (MRR) | ✅ | |
| Revenue trends | ✅ | Monthly chart with a table view, and totals by method |
| Date filters | ✅ | Default to the last 12 months |
| Payment status overview | 🟡 | Outstanding and overdue totals, no dedicated view |
| Annual recurring revenue (ARR) | ⬜ | |
| Total customers, products and plans | ⬜ | |
| Subscription growth | ⬜ | |

## How the figures are defined

| Figure | Definition | Date filter applies? |
| --- | --- | --- |
| Active subscriptions | Subscriptions with status Active | No, current |
| MRR | Active subscriptions' plan fees and lines, converted to a monthly amount, before tax and discounts | No, current |
| Revenue collected | Payments dated within the range | Yes |
| Outstanding | Confirmed invoices' unpaid balance | No, current |
| Overdue | The outstanding balance past its due date | No, current |

**MRR conversion:** daily × 365 ÷ 12, weekly × 52 ÷ 12, monthly × 1, yearly ÷ 12.

Revenue counts money actually received, not amounts invoiced.

## Performance

The figures are calculated with SQL aggregates over indexed columns, and every list is paginated. The goal is under two seconds with thousands of subscriptions. With 5,000 subscriptions and 21,789 invoices, the summary API responded in 30 ms or less on a development machine, excluding network and browser time. See [system design](../system-design.md#measured-results).

## Screens

Dashboard, for admin and staff. The figures link through to filtered invoice and subscription lists.

## API

`GET /reports/summary?from=&to=`
