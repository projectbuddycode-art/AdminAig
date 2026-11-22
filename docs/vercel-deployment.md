# Vercel deployment

The production build is `prisma generate && next build`. `vercel.json` uses that command. The build does not migrate and does not seed.

## Environment variables

Set these in the Vercel project for Production. Use the same names for Preview only when that preview has its own database.

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase pooled URL, port 6543, `pgbouncer=true&connection_limit=1&sslmode=require`. |
| `DIRECT_URL` | Yes | Supabase direct URL, port 5432. Migrations are run from a workstation; Vercel still needs the variable because the Prisma schema declares it. |
| `AUTH_SECRET` | Yes | Random string, at least 32 characters. |
| `AUTH_URL` | Yes | The public `https://` origin of this deployment. |
| `CUSTOMER_JWT_SECRET` | Yes | Different random string from `AUTH_SECRET`. |
| `ADMIN_EMAIL` | No | Not read at runtime. Used only by `npm run db:seed`. |
| `ADMIN_PASSWORD` | No | Do not store this on Vercel. Create the administrator from a workstation. |
| `DEMO_MODE` | Yes | `false` on the production deployment. Demo data seeding stays a workstation command. |
| `AIG_RUNTIME` | Yes | `production` on the production deployment. |
| `DEMO_TENANT_ENABLED` | Yes | `true` allows the workstation bootstrap to create the demo tenant. The build does not create the account. |
| `DEMO_ADMIN_EMAIL` | Yes | `projectbuddy.code@gmail.com`. Server-side only. |
| `DEMO_ADMIN_PASSWORD` | Yes | At least 12 characters. Server-side only. Never `NEXT_PUBLIC_`. The site does not log it or return it. |

`DATABASE_SSL_REJECT_UNAUTHORIZED` stays unset. Supabase hosts use TLS without requiring a private CA in the app.

## Deploy sequence

1. Push the repository, including `prisma/migrations`.
2. Set the environment variables above. Keep `DEMO_MODE=false`. Store `DEMO_ADMIN_PASSWORD` as a server variable, not a `NEXT_PUBLIC_` variable.
3. Deploy. Vercel generates the Prisma client and builds Next.js. The build does not create the demo account.
4. From a workstation, with `DATABASE_URL` and `DIRECT_URL` pointing at the same Supabase project, run `npx prisma migrate deploy`.
5. Run `npm run db:seed` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set in that shell when a production administrator is required.
6. Create the demo administrator once with the commands in `docs/demo-login.md`.
7. Open `/api/health`. The response should be `{"ok":true,"service":"aig-admin","database":"up"}`.
8. Sign in at `/login` with the demo administrator email and `DEMO_ADMIN_PASSWORD`. The button is **Continue as Administrator** and uses those credentials. It does not use a bypass login.

`npm run db:seed:demo` is a separate workstation command. It writes synthetic `tenant = demo` rows and does not rotate the demo administrator password.

## Session cookies on Vercel

Auth.js sets `__Secure-authjs.session-token` on HTTPS. Middleware must call `getToken` with `secureCookie: true` (or when `VERCEL=1`) and with `AUTH_SECRET` or `NEXTAUTH_SECRET`. If middleware looks for the non-secure cookie name, login appears to succeed and then returns to `/login`.

## Serverless notes

API routes use the shared Prisma client. The PostgreSQL pool allows one connection per instance because Supabase's pooler already multiplexes clients. Do not add a long-lived worker or a connection per request.
