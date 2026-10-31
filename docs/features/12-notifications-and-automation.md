# 12. Notifications and automation

The work that happens without anyone remembering to do it.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Automation

| Feature | Status | Note |
| --- | --- | --- |
| Recurring billing job | ✅ | Hourly, in a separate worker process |
| Catch-up after downtime | ✅ | |
| Closing ended subscriptions | ✅ | On plans set to close on their own |
| Stopping expired or used-up discounts | ✅ | Checked at each billing |
| Retrying failed billing | ✅ | A failed subscription stays due for the next run |

## Emails

| Email | Status | Note |
| --- | --- | --- |
| Password reset | ✅ | |
| Account invitation | ✅ | Staff and team-created customers |
| Quotation ready | ✅ | |
| Invoice | 🟡 | Sent when the team selects Send, not when generated |
| Subscription confirmation | ⬜ | |
| Payment confirmation | ⬜ | |
| Renewal reminder | 🟡 | Dashboard count, no email |
| Expiry notification | ⬜ | |
| Overdue reminder | 🟡 | Listed on the dashboard, no email |
| Discount expiry notification | ⬜ | |

## Delivery

With `RESEND_API_KEY` set, emails go through Resend. Without it, they're written to the API console. Either way, each is recorded in the `EmailLog` table with its status.

An invoice whose email fails shows an error, and it isn't marked as sent.

## See also

[Billing workflow](../billing-workflow.md) and [deployment](../deployment.md), which covers running the worker.
