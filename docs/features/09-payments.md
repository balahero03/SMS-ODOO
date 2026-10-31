# 9. Payments

Records money received against the right invoice, so the team can see what's still owed.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Record payments | ✅ | Admin and staff |
| Multiple methods | ✅ | Cash, bank transfer, card, UPI, cheque |
| Amount and date | ✅ | |
| Notes or references | ✅ | |
| Link to an invoice | ✅ | Every payment belongs to one invoice |
| Paid and unpaid tracking | ✅ | |
| Partial payments | ✅ | |
| Reconciliation | 🟡 | Filter by date and method; no bank statement matching |
| Edit or reverse a payment | ⬜ | A mistake currently can't be undone |
| Online payment gateway | ⬜ | Payments are recorded by the team |

## Rules

**Only confirmed invoices** accept payments.

**Overpayment is refused.** The limit is the outstanding balance, and it holds even if two people record a payment at the same moment.

**Partial payments** keep the invoice Confirmed. It moves to Paid when the balance reaches zero.

**Part-paid invoices** can't be cancelled.

**Who recorded it** is stored with each payment.

## Finding what's owed

- **Invoices:** filter by Confirmed for outstanding, Overdue for late and Paid for settled.
- **Invoice list:** an Owed column shows the balance.
- **Dashboard:** outstanding and overdue totals, and the oldest overdue invoices.

## Screens

Invoice detail: Record a payment and payment history. Payments: paginated list with date and method filters.

## API

`GET /payments`, `POST /payments/invoice/:invoiceId`
