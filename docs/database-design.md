# Database design

The source of truth is [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

## Conventions

- **Money** is stored as integer paise in columns ending `Minor`, which avoids floating-point errors.
- **Tax rates** are basis points in columns ending `Bp`, so 1800 means 18%. A percentage discount's `value` uses the same unit.
- **Business dates** are PostgreSQL `DATE` columns, handled in UTC.
- **IDs** are UUIDs. Subscriptions and invoices also get readable numbers such as `SUB-000001` and `INV-000001`.

## Tables

| Area | Table | Purpose |
| --- | --- | --- |
| Identity | `User` | Login, role, active flag, token version |
| | `PasswordResetToken` | Hashed, expiring, single-use reset tokens |
| | `Customer` | Company, phone and address, one-to-one with a user |
| Catalogue | `Product` | Name, type, sales price, cost price, notes |
| | `ProductVariant` | Attribute, value and extra price, such as Brand: Odoo, +560 |
| | `Plan` | Fee, interval, minimum quantity, availability dates, rule flags |
| | `TaxRule` | Rate, and optionally the product type it applies to |
| | `Discount` | Fixed or percentage, thresholds, dates, usage limit and count |
| Sales | `QuotationTemplate`, `QuotationTemplateLine` | Reusable plan and product lines, with validity in days |
| | `Subscription`, `SubscriptionLine` | The contract and what it bills |
| | `SubscriptionDiscount` | Which discounts apply to which subscription |
| Billing | `Invoice`, `InvoiceLine` | Issued amounts and bill-to details, stored as copies |
| | `InvoiceDiscount` | Which discounts an invoice used, and how much |
| | `Payment` | Method, amount, date, note, who recorded it |
| System | `Counter` | Gap-free document numbering |
| | `EmailLog` | Record of every email |

## Relationships

```
User 1─1 Customer 1─* Subscription 1─* Invoice 1─* Payment
Plan 1─* Subscription 1─* SubscriptionLine *─1 Product 1─* ProductVariant
Subscription *─* Discount (SubscriptionDiscount)
Invoice 1─* InvoiceLine
Invoice *─* Discount (InvoiceDiscount)
Discount *─* Product (none means the whole subscription)
```

## Statuses

**Subscription:** `DRAFT → QUOTATION → CONFIRMED → ACTIVE → CLOSED`. `ACTIVE` and `PAUSED` can switch back and forth, and any status except `CLOSED` can move to `CLOSED`. `CLOSED` is final. An expired subscription is `CLOSED` with the reason "Expired".

**Invoice:** `DRAFT → CONFIRMED → PAID`. Unpaid draft or confirmed invoices can become `CANCELLED`. Overdue isn't a stored status: it means `CONFIRMED` with a past due date.

## Integrity rules

| Rule | How it's enforced |
| --- | --- |
| A period is never billed twice | Unique index on `Invoice (subscriptionId, periodStart)` |
| One account per email | Unique `User.email`, always lowercased |
| Unique document numbers | Unique `number` columns |
| Status changes can't collide | Updates include the expected status, so the loser of a race gets a 409 |
| Payments can't exceed the balance | The invoice row is locked while a payment is recorded |
| Discount limits hold under load | Usage is claimed by a conditional update |
| Old invoices never change | They store their own prices, taxes and customer details |

## Indexes

| Table | Index | Used for |
| --- | --- | --- |
| `Subscription` | `(status, nextBillingDate)` | Finding what's due |
| `Subscription` | `(status, expiryDate)` | Closing ended subscriptions, expiry counts |
| `Subscription` | `customerId`, `createdAt` | Portal and list pages |
| `Invoice` | `(status, dueDate)` | Outstanding and overdue |
| `Invoice` | `customerId`, `createdAt` | Portal and list pages |
| `Payment` | `invoiceId`, `paidOn` | Invoice detail, revenue by date |
| `SubscriptionLine`, `InvoiceLine` | Parent ID | Loading lines |
