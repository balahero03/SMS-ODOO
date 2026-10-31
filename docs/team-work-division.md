# Team work division

How four members share this repository without getting in each other's way. The aim is parallel work with few merge conflicts:

- One repository and one folder structure.
- Each member owns specific feature modules.
- One member owns each shared file.
- API contracts and database changes are agreed before coding.
- Each member works on their own branch.

The first version of every module already exists, so each member **owns and finishes** their area rather than starting from nothing. The [features pages](features/README.md) show what's built.

## Overview

| Member | Area | Owns | Branch |
| --- | --- | --- | --- |
| 1 | Core platform | Authentication, users, customers, products, plans | `feat/platform-core` |
| 2 | Subscriptions | Quotations, subscription lifecycle | `feat/subscriptions` |
| 3 | Finance | Billing, invoices, taxes, discounts, payments, worker | `feat/finance` |
| 4 | Frontend and analytics | Dashboard, reports, customer portal, notifications, integration | `feat/dashboard-integration` |

The split follows business responsibility, not file count. Member 3 has the most financial complexity, and Member 4 has the most integration work.

## Member 1: core platform

**Branch:** `feat/platform-core`

```
apps/api/src/modules/   auth, users, customers, products, plans
apps/web/src/features/  auth, users, customers, products, plans
```

**Database tables:** `User`, `PasswordResetToken`, `Customer`, `Product`, `ProductVariant`, `Plan`

**Responsibilities:** registration, login and password reset; roles; admin-only staff creation; customer profiles; products and variants; plans, billing intervals, minimum quantity and availability.

**Remaining work:**
- Edit forms for products, plans and customers (the API already supports them)
- A customer page with subscription, invoice and payment history
- Product categories, if wanted

**Deliverable:** an admin can create and edit customers, products, variants and plans.

**Docs:** [authentication](features/01-authentication-and-users.md), [products](features/02-products.md), [plans](features/03-plans.md), [customers](features/04-customers.md)

## Member 2: subscriptions

**Branch:** `feat/subscriptions`

```
apps/api/src/modules/   quotations, subscriptions
apps/web/src/features/  quotations, subscriptions
```

**Database tables:** `QuotationTemplate`, `QuotationTemplateLine`, `Subscription`, `SubscriptionLine`

**Responsibilities:** quotation templates and validity; turning quotations into subscriptions; subscription numbers, dates and lines; activate, pause, resume, renew and close.

**Remaining work:**
- A screen for editing draft lines, quantities and prices (the API already supports this)
- A way for customers to decline a quotation in the portal

**Deliverable:** a customer receives a quotation, accepts it and ends up with an active subscription.

**Depends on:** Member 1's products and plans.

**Docs:** [quotations](features/05-quotations.md), [subscriptions](features/06-subscriptions.md)

## Member 3: finance

**Branch:** `feat/finance`

```
apps/api/src/modules/   billing, invoices, payments, discounts, taxes
apps/web/src/features/  invoices, payments, discounts, taxes
apps/worker/src/        billing worker
```

**Database tables:** `Invoice`, `InvoiceLine`, `InvoiceDiscount`, `Payment`, `Discount`, `SubscriptionDiscount`, `TaxRule`, `Counter`

**Responsibilities:** automatic invoices, billing dates, tax, discounts and their limits; confirming and cancelling invoices; recording payments, including partial ones; overdue tracking; recurring billing and duplicate prevention.

**Remaining work:**
- Generated invoice PDFs (currently through the browser's print dialog)
- Reversing a payment recorded by mistake
- A billing run history, if wanted

**Deliverable:** an active subscription produces its invoices automatically, and recording a payment updates the invoice status.

**Depends on:** Member 2's subscription data.

**Docs:** [billing and invoices](features/07-billing-and-invoices.md), [discounts](features/08-discounts.md), [payments](features/09-payments.md), [billing workflow](billing-workflow.md)

## Member 4: frontend, analytics and integration

**Branch:** `feat/dashboard-integration`

```
apps/api/src/modules/reports
apps/api/src/integrations/email
apps/web/src/features/dashboard
apps/web/src/app
apps/web/src/components
```

**Database tables:** `EmailLog`, plus any notification, audit log or settings tables added later.

**Responsibilities:** the dashboard and revenue reporting, the customer portal experience, email notifications, integration testing and deployment.

**Remaining work:**
- ARR, customer, product and plan totals, and subscription growth on the dashboard
- A combined payment history in the portal
- Emails for renewal reminders, overdue invoices, and subscription and payment confirmations
- End-to-end testing of the demo script, and deployment

The portal has no folder of its own. Customers use the subscription and invoice pages with limited access, so changes to those pages should be agreed with Members 2 and 3.

**Deliverable:** the admin can see the financial health of the business, and customers can see their own subscriptions and invoices.

**Important:** Member 4 uses the other members' APIs and doesn't rewrite their business logic.

**Docs:** [customer portal](features/10-customer-portal.md), [dashboard](features/11-dashboard-and-analytics.md), [notifications](features/12-notifications-and-automation.md), [deployment](deployment.md)

## Git workflow

```
feat/platform-core ─────────┐
feat/subscriptions ─────────┤ Pull request
feat/finance ───────────────┼───────────────► dev ──► integration testing ──► main
feat/dashboard-integration ─┘
```

`main` stays deployable. Nobody works directly on `main` or `dev`.

### One-time setup (Member 4)

The `dev` branch doesn't exist yet. Create it once, after the current work is on `main`:

```bash
git checkout main
git pull origin main
git checkout -b dev
git push -u origin dev
```

### Starting work

```bash
git clone https://github.com/balahero03/SMS-ODOO.git
cd SMS-ODOO
git checkout dev
git pull origin dev
git checkout -b feat/platform-core   # use your own branch
```

Then follow the setup steps in the [README](../README.md).

### Saving work

Add your own folders rather than using `git add -A`, so you don't pick up other files by accident:

```bash
git add apps/api/src/modules/customers apps/web/src/features/customers
git commit -m "feat(customers): add customer edit form"
git push -u origin feat/platform-core
```

Then open a pull request from your branch into `dev`. After integration testing, `dev` goes into `main`.

### Commit messages

Use `type(area): what changed`:

```
feat(customers): add customer history page
feat(invoices): generate PDF invoices
fix(discounts): stop applying expired discounts
test(billing): cover month-end billing dates
```

## Shared files

Conflicts happen in shared files, even when everyone has their own branch. Each of these has one owner, and anyone else asks the owner to make the change.

| File or folder | Owner |
| --- | --- |
| Root `package.json`, `package-lock.json` | Member 4 |
| `apps/api/src/app.ts`, `apps/api/src/server.ts` | Member 4 |
| `apps/web/src/app/App.tsx` (routes, menu and layout) | Member 4 |
| `apps/web/src/components/` | Member 4 |
| `apps/api/.env.example`, `apps/api/.env` | Member 4 |
| `docker-compose.yml`, `README.md` | Member 4 |
| `apps/api/prisma/schema.prisma` | Member 1, as schema coordinator |
| `apps/api/prisma/migrations/` | Member 1, with the module owner |
| `apps/api/prisma/seed.ts` | Member 1 |

## Database changes

All tables live in one `schema.prisma`, so changes are coordinated:

1. The member who needs a change proposes it to Member 1.
2. Member 1 updates `schema.prisma` and creates the migration.
3. Everyone pulls the change before continuing.

Member 1 only coordinates the schema. Each module owner still writes their own database logic.

**Rules:**
- Never edit a migration that has already been applied. Add a new one.
- Only one person creates a migration at a time.
- Use your own local database.
- Tell the team before resetting any shared database.
- Keep migrations in git.

## API contracts

Agree on a contract before building anything that depends on it. Then the other member can start straight away using mock data. Existing contracts are in the [API documentation](api-documentation.md). Update that file in the same pull request when you change one.

Example, `GET /api/v1/subscriptions`:

```json
{
  "data": [
    {
      "id": "6f1c…",
      "number": "SUB-000001",
      "customerId": "a31d…",
      "planId": "90be…",
      "status": "ACTIVE",
      "startDate": "2026-10-01T00:00:00.000Z",
      "nextBillingDate": "2026-11-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

## Dependencies between members

| Member | Needs | From |
| --- | --- | --- |
| 2 | Products and plans | Member 1 |
| 3 | Subscription data | Member 2 |
| 4 | Invoice and payment data | Member 3 |
| All | Schema changes | Member 1 |
| All | Routes and menu entries | Member 4 |

## Milestones

| Stage | Member 1 | Member 2 | Member 3 | Member 4 |
| --- | --- | --- | --- | --- |
| Setup | Run the app, learn auth and the schema | Agree API contracts | Learn the billing design | Create `dev`, run the app |
| Development | Edit forms, customer page | Draft editing, quotation decline | PDFs, payment reversal | Dashboard figures, emails |
| Integration | Customer APIs | Subscription APIs | Billing APIs | Reports and portal |
| Final testing | Auth tests | Lifecycle tests | Billing tests | End-to-end run |
| Demo | Admin setup | Subscription flow | Invoices and payments | Dashboard |

## Team rules

1. Stay within the folders you own.
2. Never work directly on `main` or `dev`.
3. Coordinate before changing another member's module.
4. Ask the owner to change shared files.
5. Agree API contracts before building on them.
6. Make small, frequent commits.
7. Pull the latest `dev` before starting a new branch.
8. Merge through pull requests.
9. Run `npm run build` and `npm test` before opening a pull request.
10. Never commit real secrets. `apps/api/.env` holds local development values only. Real API keys and hosted database URLs belong in the hosting platform's settings.
