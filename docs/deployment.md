# Deployment

## Local

Needs Node 20+ and Docker. See the [README](../README.md) for the steps. Local Postgres runs on port 5434.

`npm run dev` starts the API on port 4000, the worker, and the web app on port 5173.

## Environment variables

Set these for both the API and the worker.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | API | At least 32 random characters. Use a new one in production: `openssl rand -hex 32` |
| `WEB_ORIGIN` | API | Public web URL, used for CORS and email links |
| `PORT` | No | API port, default 4000 |
| `RESEND_API_KEY` | No | Without it, emails only go to the console and `EmailLog`, with reset links redacted, so password resets and invitations can't be used |
| `EMAIL_FROM` | With Resend | Sender address on a verified domain |

The values in the repository's `apps/api/.env` are for local development only. Don't reuse them in production.

## Hosted setup

This plan hasn't been tried on these hosts yet, so allow time for a test deploy.

### 1. Database (Supabase or Neon)

Create a database and copy its connection string. From `apps/api`, with `DATABASE_URL` pointing at it:

```bash
npx prisma migrate deploy
```

Run `db:seed` only for a demo environment, since it creates accounts with a known password.

### 2. API (Render web service)

| Setting | Value |
| --- | --- |
| Build | `npm ci && npx -w api prisma generate` |
| Start | `cd apps/api && npx tsx src/server.ts` |
| Health check | `/api/v1/health` |

Use these commands rather than `npm start`, which expects a local `.env` file.

### 3. Worker (Render background worker)

Use the same build command. Start with `cd apps/worker && npx tsx src/index.ts`.

Running more than one worker is safe, because the row locks stop them billing the same period. The free tier may not offer background workers. If so, use **Run billing** on the dashboard for a demo.

### 4. Web (Vercel)

Set the root directory to `apps/web`, the build command to `npm run build`, and the output to `dist`. The app calls `/api/v1` on its own domain, so add `apps/web/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-API.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Then set `WEB_ORIGIN` on the API to the Vercel URL.

## Before going live

- [ ] New `JWT_SECRET`
- [ ] Demo accounts removed or never seeded
- [ ] `RESEND_API_KEY` and a verified `EMAIL_FROM`, or password resets won't reach anyone
- [ ] `/api/v1/health` responds
- [ ] One full run: sign up, activate a subscription, bill, pay
