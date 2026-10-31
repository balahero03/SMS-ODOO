# System design

This is the design behind Brightloop Subscription Management and how the code follows it. For the current structure, see [architecture](architecture.md).

## Requirements that shaped the design

- Run the full lifecycle: products, plans, quotations, subscriptions, recurring invoices, discounts, payments and reporting.
- Three roles, with customers limited to their own records.
- Hundreds of subscriptions billed at once, with nothing skipped or billed twice.
- Pages respond in under two seconds with thousands of subscriptions.

## Key decisions

### One backend, divided into modules

The core decision is one codebase and one PostgreSQL database, organised into business modules.

| Option | Assessment |
| --- | --- |
| Traditional monolith | Quick to build, but tends to become tightly coupled |
| **Modular monolith (chosen)** | Clear boundaries, simple to deploy |
| Microservices | Separate deployments, distributed transactions and more monitoring, none of which this project needs |

Billing and subscriptions must change together. Keeping them in one database means one transaction can cover both.

### PostgreSQL as the source of truth

The data is strongly relational, and the database enforces the rules that matter most, such as one invoice per billing period. Any hosted PostgreSQL works, including Supabase or Neon.

### Money as integers

Amounts are stored in paise, so ₹99.99 is `9999`. This avoids floating-point rounding errors.

### Invoices keep their own copies

An invoice stores the prices, taxes and descriptions from when it was created. If a product goes from ₹1,000 to ₹1,500, old invoices still show ₹1,000.

### Status rules live on the server

The backend decides which status changes are valid, so a closed subscription can't be reactivated by an API request.

### Authentication and authorisation are separate

Authentication establishes who the user is. Authorisation decides what they can do, using the role stored in the database and never a role sent by the frontend.

## Request flow

1. The React app calls the versioned REST API under `/api/v1`.
2. Middleware verifies the token and loads the user's role.
3. The route checks the role and validates input with Zod.
4. The module applies its business rules and uses PostgreSQL.
5. Long-running billing happens in the worker, outside any web request.

## Billing

The worked example from the design: a monthly subscription at ₹1,000 with 18% tax.

```
subtotal 100000 − discount 0 = taxable 100000
tax      round(100000 × 0.18) = 18000
total    118000 paise = ₹1,180
```

The classic failure is a crash after creating an invoice but before moving the next billing date, so the retry bills again. Here both happen in one transaction, and a unique index on `(subscriptionId, periodStart)` is the final guard. See [billing workflow](billing-workflow.md).

## Performance approach

There are no microservices or caching layers. The approach is:

- Indexes on the fields used for filtering, such as status with next billing date, status with due date, and customer. See [database design](database-design.md).
- Pagination on subscriptions, invoices, payments and customers, up to 100 rows per page.
- Dashboard totals calculated by SQL aggregates, not by loading rows into Node.
- Billing kept out of web requests, except a single invoice at activation.

### Measured results

Measured on a development machine with `SEED_SUBS=5000`: 5,000 subscriptions, 21,789 invoices and 19,951 payments. These are API response times against local Postgres, so they exclude network and browser rendering time.

| Request | Slowest of three runs |
| --- | --- |
| Dashboard summary | 30 ms |
| Subscriptions list, including page 100 | 8 ms |
| Subscription search by number | 7 ms |
| Invoice list, overdue filter | 7 ms |
| Invoice search by number | 22 ms |
| Payments and customers lists | 7 ms or less |

A billing run created 3,450 invoices in about 25 seconds with no failures, and an immediate second run created none.

## Where the code differs from the original design

| Original design | Current code | Reason |
| --- | --- | --- |
| Supabase Auth | JWT and bcrypt in the API | Works with any PostgreSQL host and needs no external account |
| BullMQ and Redis | Separate worker with an hourly scheduler and database locks | The design allowed a PostgreSQL-based start, and it's less to deploy |
| Queued email | Email sent directly | Few emails are sent per request |
| Idempotency keys, job status tracking | Row locks and the unique index; failures are logged and retried on the next run | Double billing is prevented without them, but there's no job history screen |
| Controllers and repositories in each module | Routes and services | Less boilerplate at this size |
| shadcn/ui | Small custom Tailwind components | Fewer dependencies |
| Swagger / OpenAPI | [Written API documentation](api-documentation.md) | No generated spec yet |
| `EXPIRED` status | `CLOSED` with the reason "Expired" | Follows the path in the brief |
| `POST /invoices` | Invoices come only from billing | Stops hand-typed invoices and double billing |
| `POST /invoices/:id/payments` | `POST /payments/invoice/:invoiceId` | Same function, different path |
| `/dashboard/*` | `GET /reports/summary` | One request fills the dashboard |
| `?status=OVERDUE` | `?overdue=true` | Overdue is worked out from the due date, not stored |
| Payment gateway and webhooks | Payments recorded by the team | The brief asks for recording; see [features](features/README.md) |
