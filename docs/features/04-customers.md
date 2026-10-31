# 4. Customers

The people and companies Brightloop bills.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Create customers | ✅ | Admin and staff |
| Update customers | ✅ | |
| Deactivate customers | ✅ | Admin only; refused while a subscription is open. Customers are never deleted, so their history stays |
| Company details | ✅ | Company name and address |
| Contact information | ✅ | Name, email, phone |
| Search | ✅ | Name, company or email |
| Filter by attribute | ⬜ | Search only |
| Subscription and invoice history | ✅ | On the customer page |
| Payment history per customer | ⬜ | Shown per invoice for now; waiting on the `GET /payments` filter below |

## Rules

**Every customer has a login.** A team-created customer gets an emailed link to set a password. A customer who signs up gets their record automatically.

**Unique email:** an email already in use can't be used for a new customer.

**No linking by email:** signing up with an email never grants access to an existing customer's records. Without email verification, that would let anyone claim someone else's invoices.

**Invoices keep their own copy** of the customer's name, email and address, so later changes don't alter old invoices.

## Screens

Customers: paginated list, search and add customer.

## API

`GET|POST /customers`, `GET|PATCH /customers/:id`, `GET /subscriptions?customerId=`, `GET /invoices?customerId=`

## Needed from finance

The customer page needs a customer filter on the payments list. Until it exists, the API ignores an unknown `customerId` and returns every customer's payments, so the page must not call it.

`GET /payments?customerId=<id>`, added to the existing route and access (admin and staff):

- **Filter:** `invoice: { customerId }` on the server, combined with the existing `from`, `to` and `method` filters and included in `total`.
- **Unknown customer:** an empty list, `{ data: [], total: 0, page, limit }`.
- **Response:** unchanged, `{ data, total, page, limit }`, each row with `id, method, amountMinor, paidOn, note, invoice: { id, number, billToName }`.
- **Order:** unchanged, `paidOn` then `createdAt`, newest first.
