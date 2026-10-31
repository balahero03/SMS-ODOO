# 4. Customers

The people and companies Brightloop bills.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Create customers | ✅ | Admin and staff |
| Update customers | 🟡 | API only |
| Company details | ✅ | Company name and address |
| Contact information | ✅ | Name, email, phone |
| Search | ✅ | Name, company or email |
| Filter by attribute | ⬜ | Search only |
| Subscription and invoice history | 🟡 | API filters by customer; no customer page yet |
| Payment history per customer | ⬜ | Payments are shown per invoice or across all customers |

## Rules

**Every customer has a login.** A team-created customer gets an emailed link to set a password. A customer who signs up gets their record automatically.

**Unique email:** an email already in use can't be used for a new customer.

**No linking by email:** signing up with an email never grants access to an existing customer's records. Without email verification, that would let anyone claim someone else's invoices.

**Invoices keep their own copy** of the customer's name, email and address, so later changes don't alter old invoices.

## Screens

Customers: paginated list, search and add customer.

## API

`GET|POST /customers`, `GET|PATCH /customers/:id`, `GET /subscriptions?customerId=`, `GET /invoices?customerId=`
