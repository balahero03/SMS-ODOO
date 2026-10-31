# Frontend updates

What has changed in the web app on the `frontend-analytics` branch. Update this file as new screens land.

## Done

### Auth pages

Login, sign-up, forgot password and reset password share a new layout in `src/features/auth/pages/Auth.tsx`.

- Sign-up has a live password checklist and a confirm password field.
- A blank company name is no longer saved as an empty value, so invoices fall back to the customer's name.

### Customer portal

Customers now have their own screens and sidebar in `src/features/customer-portal/`. Admin and staff pages are unchanged.

| URL | Screen | File |
| --- | --- | --- |
| `/overview` (new, customer home) | Alerts, totals, subscriptions, recent invoices | `pages/Overview.tsx` |
| `/subscriptions` | Status filters and search | `pages/Subscriptions.tsx` |
| `/subscriptions/:id` | Details, plus pause, resume, renew and close with confirmation | `pages/Subscriptions.tsx` |
| `/subscriptions/:id` while a quotation | Review, confirm or decline | `pages/Subscriptions.tsx` |
| `/invoices` | Totals, status filters and search | `pages/Invoices.tsx` |
| `/invoices/:id` | Invoice, payments, print or save as PDF | `pages/Invoices.tsx` |
| `/payments` | Payment history with date and method filters | `pages/Payments.tsx` |
| `/plans` | Available plans to request | `pages/BrowsePlans.tsx` |
| `/plans/:id/request` | Choose products, start date and a note | `pages/BrowsePlans.tsx` |

Shared pieces for these pages are in `components.tsx`.

The team also has a new **Customer requests** page at `/requests`, in `src/features/customer-requests/`.

**How a customer gets a subscription:** customers request a plan rather than buying it instantly, because the app has no payment gateway.

1. The customer signs up and picks a plan and products under **Browse plans**. Staff can also create a quotation without a request, as before.
2. Staff see the request under **Customer requests**, review it and send a quotation.
3. The customer reviews the quotation in the portal and confirms it.
4. Staff activate it, and billing creates the invoices.
5. Staff confirm invoices and record payments, and the customer sees them in the portal.

These pages only show real records from the API. They contain no mock data.

**Backend needed:** the request pages depend on `GET /catalog`, `POST /subscriptions/request`, `requested=true` on the subscription list, and `requestedAt` and `requestNote` on subscriptions. Until those exist, Browse plans shows "Plans can't be loaded right now", and Customer requests lists every draft.

## How routing works

`src/app/App.tsx` is the only existing file the portal changes. A small `ByRole` wrapper picks the screen, so `/subscriptions` shows the customer page to customers and the team page to everyone else. Customers land on `/overview` after signing in. Team users who open `/overview` go to the dashboard.

**Changes to the team's subscription, invoice or payment pages don't affect customers.** A change meant for both needs making in both places.

## Style

| Token | Value | Used for |
| --- | --- | --- |
| Purple | `#5b3fe8` | Main actions, active menu item, links |
| Dark purple | `#2e1f8f` | Text on lavender |
| Lavender | `#c9c0fb`, `#e4dfff`, `#f1eeff` | Badges, alerts, soft offset shadows |
| Cream | `#fbf8f1` | Page background |
| Soft red | `red-50`, `red-700` | Overdue, errors and destructive actions only |
| Font | Plus Jakarta Sans | Loaded from Google Fonts by the page that uses it |

Avoid neon colours, black outlines and hard black shadows.

## Known limits

These need backend work to go away. The frontend works within them for now.

- **Totals:** the API has no customer summary and returns at most 100 records a page, so totals on Overview and My invoices cover the latest 100. The page says so when there are more.
- **Payment history:** customers have no payments endpoint, so the page loads each part-paid or paid invoice separately. That's fine for demo volumes but slow with many invoices.
- **Declining a quotation:** this closes the subscription through the existing `close` action, so it shows as Closed rather than Declined.
- **Add-ons:** the brief says customers switch add-ons on and off, but the API only allows line changes while a subscription is a draft, and only for staff. The portal has no add-on control yet.
- **Paying an invoice:** there's no online payment, so invoices tell customers to contact their Brightloop team. No contact details are shown yet.
- **Tax on quotations:** customers can't read tax rules, so quotations show totals before tax and the plan fee's tax shows as "—". Invoices show the real tax.

## Open issues

- **Web packages:** `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `@types/react` and `@types/react-dom` are missing from `apps/web/package.json`. A fresh clone can't start the frontend until they're added: `npm install -D -w web vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom`
- **Build:** `npm run build` also fails on existing type errors in `features/dashboard/pages/Dashboard.tsx` and `features/invoices/pages/Invoices.tsx`.
- **Demo data:** the demo customer's invoices are all drafts after seeding, so customers see none. Sign in as admin and use **Confirm all drafts** on the Invoices page before a demo.

## Not started

- Restyling the admin and staff screens to match
- Customer profile editing, which has no API yet
