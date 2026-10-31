# Features

Brightloop Subscription Management helps a business run its entire subscription lifecycle, from creating products and plans to generating invoices, collecting payments and analysing revenue. Each area below has its own page.

**Status key:** ✅ built · 🟡 partly built, as explained on the page · ⬜ not built

| # | Area | Summary | Status |
| --- | --- | --- | --- |
| 1 | [Authentication and users](01-authentication-and-users.md) | Accounts, password reset, three roles | ✅ |
| 2 | [Products](02-products.md) | Products, prices, variants | 🟡 Edit screen missing |
| 3 | [Plans](03-plans.md) | Billing intervals, availability, plan rules | 🟡 Edit screen missing |
| 4 | [Customers](04-customers.md) | Profiles and search | 🟡 History page missing |
| 5 | [Quotations](05-quotations.md) | Templates and validity | ✅ |
| 6 | [Subscriptions](06-subscriptions.md) | Numbers, lines, lifecycle | 🟡 Line editing is API only |
| 7 | [Billing and invoices](07-billing-and-invoices.md) | Automatic invoices, tax, send, print | 🟡 PDF through print |
| 8 | [Discounts](08-discounts.md) | Rules applied automatically | ✅ |
| 9 | [Payments](09-payments.md) | Recording and partial payments | 🟡 Basic reconciliation |
| 10 | [Customer portal](10-customer-portal.md) | Self-service, own records only | 🟡 Some views missing |
| 11 | [Dashboard and analytics](11-dashboard-and-analytics.md) | Revenue, outstanding, overdue, MRR | 🟡 Some figures missing |
| 12 | [Notifications and automation](12-notifications-and-automation.md) | Billing jobs and emails | 🟡 Reminders not emailed |

## Priorities

### P0: core features (must have)

These demonstrate the complete business workflow.

| Feature | Status |
| --- | --- |
| Authentication and role-based access | ✅ |
| Product and plan management | 🟡 Edit screens missing |
| Customer management | 🟡 History page missing |
| Subscription creation and lifecycle | ✅ |
| Automatic invoice generation | ✅ |
| Payment recording | ✅ |
| Admin dashboard | ✅ |

### P1: important features (should have)

These make the application more complete and competitive.

| Feature | Status |
| --- | --- |
| Discount management | ✅ |
| Quotation templates | ✅ |
| Customer self-service portal | ✅ |
| Tax configuration | ✅ |
| Overdue invoice tracking | ✅ |
| Invoice PDF generation | 🟡 Through the browser's print dialog |
| Renewal reminders | 🟡 Dashboard count, no email |

### P2: advanced features (nice to have)

These add polish and show engineering depth. None are built.

| Feature | Status |
| --- | --- |
| Payment gateway integration | ⬜ |
| Advanced revenue analytics | ⬜ |
| Subscription upgrade and downgrade | ⬜ |
| Automated payment retries | ⬜ |
| Audit logs | ⬜ |
| Revenue forecasting | ⬜ |
| Usage-based billing | ⬜ |

## Demo script

The central story is the subscription-to-invoice-to-payment workflow, followed by what sets this apart from a basic CRUD application: the customer portal, discounts and automated billing.

1. **Admin:** show a product variant, a plan's rules, a tax rule and a discount.
2. **Staff:** create a subscription from a quotation template and send it.
3. **Customer:** sign in to the portal and confirm the quotation.
4. **Staff:** activate it. The first invoice appears by itself. Then attach a discount.
5. **Admin:** run billing for a future date. Invoices appear across subscriptions, with the discount applied.
6. **Admin:** run billing again with the same date. No new invoices for those periods, which shows nothing is billed twice.
7. **Staff:** confirm the drafts and record a partial payment, then the rest. The invoice moves to Paid.
8. **Finance view:** finish on the dashboard's revenue, outstanding and overdue figures.
9. **Customer:** show that another customer's invoice can't be opened.
