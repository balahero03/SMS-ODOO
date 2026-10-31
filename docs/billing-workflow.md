# Billing workflow

The rule from the brief: nothing billed twice, nothing skipped.

## When billing runs

- Hourly, and on startup, in the worker process.
- At once for one subscription when it is activated, if its first period has started.
- On demand, when an admin uses **Run billing** on the dashboard.

## What a run does

1. Find `ACTIVE` subscriptions whose `nextBillingDate` has arrived.
2. Bill each due period in its own transaction.
3. Repeat until nothing is due, which catches up periods missed during downtime.
4. Close subscriptions past their expiry date if their plan closes on its own.

Each period's transaction does the following, and a crash at any point undoes all of it:

1. Lock the subscription with `FOR UPDATE SKIP LOCKED`.
2. Stop if the period starts on or after the expiry date.
3. If an invoice already exists for this period, just advance the billing date.
4. Build the lines: the plan fee, if any, plus each product line.
5. Look up tax rates from the active rules.
6. Check each attached discount and claim one use.
7. Calculate the totals and create a `DRAFT` invoice with the next invoice number.
8. Advance `nextBillingDate`.

## How double billing is prevented

| Situation | What protects it |
| --- | --- |
| Two runners at once | The row lock: the second runner skips that subscription |
| Crash mid-invoice | The transaction rolls everything back, so the period stays due |
| Billing date out of step with invoices | The existing-invoice check moves the date forward without billing |
| A bug gets past all of these | The unique index on `(subscriptionId, periodStart)` rejects the insert |

If one subscription fails, the error is logged, the rest continue, and that subscription stays due for the next run.

## Calculating an invoice

```
line gross    = quantity × unit price
discount      = taken from the eligible lines
taxable       = line gross − line discount
line tax      = taxable × tax rate, rounded to the paisa
invoice total = subtotal − discounts + tax
```

Example: 2 seats at ₹1,000 with 10% off and 18% tax.

| | Amount |
| --- | --- |
| Subtotal | ₹2,000.00 |
| Discount | −₹200.00 |
| Tax on ₹1,800 | ₹324.00 |
| **Total** | **₹2,124.00** |

## Billing dates

Each date is worked out from the start date: `start + cycles × interval`. A monthly subscription starting on 31 January bills on 28 February and then 31 March, rather than drifting to the 28th for good.

The first invoice covers the period beginning on the start date, so customers are billed in advance. A period ends the day before the next one starts.

## Taxes

Every active rule that matches a line is added together. A rule with no product type applies to everything, including the plan fee. Rates are read when the invoice is created, so a rule change affects future invoices only.

## Discounts

The admin creates the rule, and the team applies it to a subscription. At each billing, a discount applies only if:

- the period start falls within its dates
- the lines it covers meet its minimum purchase and quantity
- it has uses left

Each invoice counts as one use. Several discounts apply in the order they were attached, and a line can't go below zero. Cancelling an invoice gives its uses back.

## After the invoice is created

```
DRAFT ──confirm──► CONFIRMED ──fully paid──► PAID
  │                    │
  └──────cancel────────┴──► CANCELLED (only if nothing has been paid)
```

- **Confirm** one at a time, or use **Confirm all drafts** after a large run. Customers see invoices only once they're confirmed.
- **Send** emails a confirmed or paid invoice.
- **Partial payments** keep an invoice `CONFIRMED` until the balance reaches zero. Payments above the balance are refused.
- **Overdue** means confirmed and past its due date, which is the billing date plus the subscription's payment terms.
- **Cancelling** doesn't lead to a new bill for that period.

## Pausing, renewing and closing

- **Pause:** periods that start during a pause aren't billed. Anything already due before the pause still is.
- **Renew:** extends the expiry date by the original term, or to a chosen date. A plan that closes on its own can't be renewed past its end date.
- **Expiry:** billing stops either way. Only plans set to close on their own move to `CLOSED`; others stay `ACTIVE` until someone renews or closes them.

## Rehearsing a billing day

1. Sign in as admin and open the dashboard.
2. Under **Billing run**, choose a date and select **Run billing**.
3. Open **Invoices**, filter by Draft, and select **Confirm all drafts**.
4. Run billing again with the same date. It creates no new invoices for those periods.

A future date creates real invoices, so only rehearse on demo data.
