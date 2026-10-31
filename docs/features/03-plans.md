# 3. Plans

A plan sets how often a subscription bills, when it's available, and what can happen to it later.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Create plans | ✅ | Admin only |
| Update plans | ✅ | Edit form, details view, and retire or restore |
| Daily, weekly, monthly and yearly billing | ✅ | |
| Plan pricing | ✅ | A fee per billing period; can be zero |
| Minimum quantity | ✅ | |
| Availability start and end dates | ✅ | |
| Automatic closing at the end | ✅ | Set plan by plan |
| Pause, renew and close options | ✅ | Set plan by plan |

## Rules

**Plan fee:** charged each period on top of the product lines. Use 0 for pure per-seat pricing.  A new fee applies from the next invoice; issued invoices never change.

**Billing interval:** fixed once a plan exists, because billing dates are worked out from it. Create a new plan instead.

**Minimum quantity:** every product line on a subscription must meet it.

**Availability:** a subscription's start date must fall within the plan's dates, and the plan must be active.

**Plan-by-plan options:**

| Option | Effect |
| --- | --- |
| Closes on its own | Subscriptions close automatically after their expiry date, and can't run past the plan's end date |
| Can be closed early | Running subscriptions can be closed |
| Can be paused | Active subscriptions can be paused |
| Can be renewed | The expiry date can be extended |

The server enforces these options, so hiding a button isn't the only protection.

## Screens

Plans: list with search, filters and pages; add and edit plans; details.

## API

`GET|POST /plans`, `GET|PATCH /plans/:id`
