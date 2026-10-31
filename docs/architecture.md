# Architecture

Brightloop Subscription Management runs the full life of a subscription business: products and plans, quotations, subscriptions, recurring invoices, discounts, payments and revenue reporting.

## Shape

It is a modular monolith: one codebase and one PostgreSQL database, divided into business modules and run as two backend processes.

```
Browser (React)
    │  REST, /api/v1, bearer token
    ▼
API process (Express) ──────┐
    │                       ├──► PostgreSQL
    ▼                       │
Business modules            │
    ▲                       │
    │                       │
Worker process (hourly) ────┘
```

The API and the worker call the same billing code, so billing logic exists in one place. Billing and subscriptions need to stay consistent with each other, and one database lets them share a transaction. That's the main reason for not using microservices.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL 16, Prisma 6 |
| Background work | Separate Node process with an hourly scheduler |
| Email | Resend when `RESEND_API_KEY` is set; otherwise console and the `EmailLog` table |

## Repository layout

```
apps/api/prisma        schema, migrations, seed
apps/api/src/config    environment and database client
apps/api/src/middleware  authentication, roles, errors
apps/api/src/modules   business modules
apps/api/src/shared    errors, dates, pagination, document numbering
apps/api/tests         unit and integration tests
apps/worker/src        billing scheduler
apps/web/src/features  React pages, grouped by feature
apps/web/src/components, lib  shared UI and helpers
```

## Modules

| Module | Responsibility |
| --- | --- |
| auth | Sign-up, login, password reset |
| users | Staff accounts (admin only) |
| customers | Customer records and portal invitations |
| products | Products and variants |
| plans | Pricing, billing interval, availability, plan-by-plan rules |
| taxes | Tax rules and rate lookup |
| discounts | Discount rules |
| quotations | Quotation templates |
| subscriptions | Lifecycle and status changes |
| billing | Billing runs and invoice calculation |
| invoices | Confirm, cancel, send |
| payments | Recording payments |
| reports | Dashboard figures |

Each module has routes, and modules with real business rules also have a service. Thin create, read and update modules keep their logic in the routes. There are no separate controller or repository layers.

## Security

- Passwords are hashed with bcrypt. Reset tokens are random, stored only as hashes, expire after an hour and work once.
- Roles are read from the database on every request, never taken from the client.
- Resetting a password invalidates existing sessions.
- Customer queries are always limited to that customer's records. Requests for someone else's record return 404.
- Customers never see draft subscriptions or invoices, or product cost prices.
- Staff-created accounts get an emailed link to set a password. A self-signup never gains access to an existing customer's records by using the same email.

## Known limits

- Payments are recorded by the team. There is no payment gateway.
- A recorded payment can't be edited or reversed.
- Business dates use UTC, so the billing day rolls over at 05:30 IST.
- One currency (INR).
