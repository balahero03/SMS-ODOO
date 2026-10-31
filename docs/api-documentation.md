# API documentation

Base URL: `/api/v1`

Send `Authorization: Bearer <token>` on everything except the public auth routes. Tokens last 12 hours.

**Formats:** dates are `YYYY-MM-DD`. Money is integer paise, so ₹1,000 is `100000`. Tax rates and percentage discounts are basis points, so 18% is `1800`.

**Lists:** paginated lists take `page` and `limit` (maximum 100) and return `{ data, total, page, limit }`. Lists of catalogue and setup records return all rows as `{ data }`, except `/plans`, which is paginated.

**Errors:** every error returns `{ "message": "..." }`.

| Status | Meaning |
| --- | --- |
| 400 | Invalid input |
| 401 | Not signed in, or the token is invalid |
| 403 | Your role can't do this |
| 404 | Not found, or not yours |
| 409 | Not allowed in the current state, or a duplicate |

**Access column:** Admin is admin only, Team is admin and staff, All includes customers, limited to their own records.

## Auth

| Method | Path | Access | Body |
| --- | --- | --- | --- |
| POST | `/auth/signup` | Public | `name, email, password, companyName?` |
| POST | `/auth/login` | Public | `email, password` |
| POST | `/auth/forgot-password` | Public | `email` |
| POST | `/auth/reset-password` | Public | `token, password` |
| GET | `/auth/me` | All | |

Passwords need more than eight characters, with an uppercase letter, a lowercase letter and a special character.

```bash
curl -X POST localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@brightloop.test","password":"Demo@12345"}'
```

## People

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/users/staff` | Admin | |
| POST | `/users/staff` | Admin | `name, email`; emails a link to set a password |
| PATCH | `/users/staff/:id` | Admin | `active` |
| GET | `/customers` | Team | Paginated; filter `q` |
| POST | `/customers` | Team | `name, email, companyName?, phone?, address?` |
| GET | `/customers/:id` | Team | |
| PATCH | `/customers/:id` | Team | |

## Catalogue

Team can read these. Only the admin can change them.

| Method | Path | Notes |
| --- | --- | --- |
| GET, POST | `/products` | `name, type, salesPriceMinor, costPriceMinor, notes?, variants?` |
| GET, PATCH | `/products/:id` | |
| POST | `/products/:id/variants` | `attribute, value, extraPriceMinor` |
| DELETE | `/products/:id/variants/:variantId` | |
| GET, POST | `/plans` | `name, priceMinor, interval, minQuantity, availableFrom, availableUntil?, autoClose, closable, pausable, renewable` |
| GET, PATCH | `/plans/:id` | |
| GET, POST | `/taxes` | `name, rateBp, productType?` |
| PATCH | `/taxes/:id` | |
| GET, POST | `/discounts` | `name, type, value, minPurchaseMinor, minQuantity, startDate, endDate, usageLimit?, productIds` |
| PATCH | `/discounts/:id` | Send the full discount |
| GET, POST | `/templates` | `name, validityDays, planId, lines[]` |
| DELETE | `/templates/:id` | |

`type` is `SOFTWARE`, `ADDON` or `SERVICE` on products, and `FIXED` or `PERCENT` on discounts. `interval` is `DAILY`, `WEEKLY`, `MONTHLY` or `YEARLY`.

## Subscriptions

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/subscriptions` | All | Paginated; filters `status, customerId, q` |
| POST | `/subscriptions` | Team | `customerId, planId, startDate, expiryDate?, paymentTermsDays, validityDays, lines[]` |
| POST | `/subscriptions/from-template` | Team | `templateId, customerId, startDate, expiryDate?, paymentTermsDays` |
| GET | `/subscriptions/:id` | All | |
| PUT | `/subscriptions/:id` | Team | Drafts only |
| POST | `/subscriptions/:id/send` | Team | Draft to Quotation; emails the customer |
| POST | `/subscriptions/:id/confirm` | All | Quotation to Confirmed, unless it has expired |
| POST | `/subscriptions/:id/activate` | Team | Confirmed to Active; bills at once if due |
| POST | `/subscriptions/:id/pause` | All | If the plan allows |
| POST | `/subscriptions/:id/resume` | All | |
| POST | `/subscriptions/:id/renew` | All | If the plan allows; optional `expiryDate`, otherwise extends by the original term |
| POST | `/subscriptions/:id/close` | All | Running subscriptions need a plan that allows closing |
| POST | `/subscriptions/:id/discounts` | Team | `discountId` |
| DELETE | `/subscriptions/:id/discounts/:discountId` | Team | |

A line is `{ productId, variantId?, quantity, unitPriceMinor? }`. Without a price, it uses the product's sales price plus the variant's extra price.

## Invoices and payments

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/invoices` | All | Paginated; filters `status, overdue, q, customerId, from, to` |
| GET | `/invoices/:id` | All | |
| POST | `/invoices/confirm-drafts` | Team | Confirms every draft |
| POST | `/invoices/:id/confirm` | Team | A zero-total invoice goes straight to Paid |
| POST | `/invoices/:id/cancel` | Team | Unpaid only; returns any discount use |
| POST | `/invoices/:id/send` | Team | Confirmed or Paid only |
| GET | `/payments` | Team | Paginated; filters `from, to, method` |
| POST | `/payments/invoice/:invoiceId` | Team | `method, amountMinor, paidOn, note?` |

`method` is `CASH`, `BANK_TRANSFER`, `CARD`, `UPI` or `CHEQUE`.

## Billing and reports

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/billing/run` | Admin | Optional `asOf`. A future date creates real invoices |
| GET | `/reports/summary` | Team | Optional `from, to`; defaults to the last 12 months |
| GET | `/health` | Public | |
