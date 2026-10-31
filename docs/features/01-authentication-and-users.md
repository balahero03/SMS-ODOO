# 1. Authentication and users

Controls who can sign in and what each person can see and do.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Registration with email and password | ✅ | Creates a customer account |
| Login and logout | ✅ | Sessions last 12 hours; logout ends them on all devices |
| Password reset by email | ✅ | |
| Admin, Staff and Customer roles | ✅ | |
| Admin-only staff creation | ✅ | |
| Deactivating staff | ✅ | Admin only; takes effect on their next request |
| Customer-specific access | ✅ | See [customer portal](10-customer-portal.md) |

## Rules

**Email:** each email can belong to one account. Emails are stored in lowercase, so `A@x.com` and `a@x.com` count as the same.

**Password:** more than eight characters, with an uppercase letter, a lowercase letter and a special character. `Abcdef@1` is refused because it has exactly eight.

**Password reset:**
- The link arrives at the registered email and works for one hour, once.
- The response is the same whether or not the email has an account, so the form can't be used to find out who has one.
- Resetting a password signs that user out everywhere and cancels their other reset links.
- Reset links are never stored: `EmailLog` keeps a redacted copy.

**Accounts created by someone else:** staff and team-created customers receive a link, valid for 72 hours, to set their own password.

**Login protection:** login, sign-up and reset routes allow 50 attempts per 15 minutes from one address.

## What each role can do

| Area | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Products, plans, taxes, discounts, templates | Manage | View | No access |
| Staff accounts | Manage | No access | No access |
| Customers, invoices, payments | Yes | Yes | Own invoices only |
| Subscriptions | Yes | Yes | Own only |
| Dashboard | Yes | Yes | No access |
| Manual billing run | Yes | No | No |

The role is read from the database on every request. Anything the browser claims about a role is ignored.

## Screens

Sign in, Create account, Forgot password, Reset password, and Staff (admin only).

## API

`POST /auth/signup`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`, `GET|POST /users/staff`, `PATCH /users/staff/:id`
