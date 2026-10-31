# Brightloop Subscription Management

One platform for plans, subscriptions, recurring billing, payments and revenue reporting.
A modular monolith: Express + TypeScript + Prisma on PostgreSQL, with a React + Vite front end.

## Run it

Needs Node 20+ and Docker.

```bash
npm install
npm run db:up
cp apps/api/.env.example apps/api/.env      # then set JWT_SECRET to 32+ random characters
npm run db:migrate
npm run db:seed                             # SEED_SUBS=5000 npm run db:seed for a load test
npm run dev
```

Open http://localhost:5173. The password for all demo accounts is `Demo@12345`:

| Role | Email |
| --- | --- |
| Admin | admin@brightloop.test |
| Staff | staff@brightloop.test |
| Customer | customer@brightloop.test |

Run the tests with `npm test`. They use a separate `sms_test` database, which is reset on each run.

Without `RESEND_API_KEY`, emails go to the API console and the `EmailLog` table. Reset links appear in full only in the local development console; `EmailLog` and production logs keep a redacted copy.

## Layout

```
apps/api/prisma        schema, migrations, seed
apps/api/src/modules   auth, users, customers, products, plans, taxes, discounts,
                       quotations, subscriptions, billing, invoices, payments, reports
apps/worker/src        separate process that runs billing on a schedule, using the API's billing module
apps/web/src/features  React pages, grouped by feature
```

## Documentation

- [Features, feature by feature](docs/features/README.md)
- [System design](docs/system-design.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [API documentation](docs/api-documentation.md)
- [Billing workflow](docs/billing-workflow.md)
- [Deployment](docs/deployment.md)
- [Team work division](docs/team-work-division.md)

## Rules worth knowing

**Billing can't double-bill or skip.** Each period is billed in one transaction that locks the
subscription (`FOR UPDATE SKIP LOCKED`), creates the invoice, claims discounts and advances
`nextBillingDate`. A unique index on `(subscriptionId, periodStart)` is the final guard. Periods missed
during downtime are caught up on the next run, and one failing subscription doesn't stop the rest.

**Invoice amounts.** Each period bills the plan fee plus every product line. Discounts come off before
tax, and tax is calculated per line from the active rules. Invoices store their own copy of prices,
taxes and customer details, so later changes never alter them. Money is stored as integer paise.

**Discounts.** The admin creates them; the team applies them to a subscription. Each invoice counts as
one use, and cancelling an invoice gives the use back.

**Cancelled invoices.** A cancelled period isn't billed again automatically.

**Pausing.** Periods that start during a pause aren't billed.

**Dates.** Business dates use UTC, so billing rolls over at 05:30 IST.

## Roles

| | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Products, plans, taxes, discounts, templates | Manage | View | No |
| Add staff | Yes | No | No |
| Customers, subscriptions, invoices, payments | Yes | Yes | Own subscriptions and invoices, read-only invoices |
| Confirm a quotation; pause, resume, renew or close a subscription | Yes | Yes | Own, where the plan allows |
| Dashboard | Yes | Yes | No |
| Run billing manually | Yes | No | No |

## API

REST under `/api/v1`: `auth`, `users/staff`, `customers`, `products`, `plans`, `taxes`, `discounts`,
`templates`, `subscriptions`, `billing/run`, `invoices`, `payments`, `reports/summary`.
List endpoints take `page` and `limit`.
