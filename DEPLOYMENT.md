# Vercel Deployment - Environment Variables

The Vercel build command is `prisma generate && next build` (Prisma 6.16.3). `prisma migrate deploy` does not accept `--skip-generate`. Apply migrations separately with `npx prisma migrate deploy` when `DATABASE_URL` points at the target database. Do not run `prisma db push` against production.

The application uses PostgreSQL. A `file:` SQLite URL is not a Vercel database. Set `DATABASE_URL` to the Supabase pooled connection and `DIRECT_URL` to the direct connection, then run `npx prisma migrate deploy` from a workstation.

When deploying to Vercel, ensure the following environment variables are set in your Vercel project settings:

## Required Environment Variables

```
DATABASE_URL=<supabase pooled postgres url>
DIRECT_URL=<supabase direct postgres url>
AUTH_SECRET=<generate-a-secure-32-character-random-string>
AUTH_URL=https://<your-domain>.vercel.app
CUSTOMER_JWT_SECRET=<generate-a-separate-32-character-random-string>
DEMO_TENANT_ENABLED=true
DEMO_ADMIN_EMAIL=projectbuddy.code@gmail.com
DEMO_ADMIN_PASSWORD=<set-only-in-vercel-or-the-shell-never-in-git>
```

`ADMIN_PASSWORD` and `DEMO_ADMIN_PASSWORD` are for the one-time workstation commands. Request handlers do not read them.

The demo administrator is created once, from a workstation, against the same database Vercel uses. Set `DEMO_TENANT_ENABLED=true`, `DEMO_ADMIN_EMAIL=projectbuddy.code@gmail.com`, and `DEMO_ADMIN_PASSWORD` in that shell. Then run `npm run demo:create`. The build does not create the account, and a second run does not change the password. See `docs/demo-login.md`.

## Generating Secrets

For `AUTH_SECRET` and `CUSTOMER_JWT_SECRET`, generate random 32-character hexadecimal strings:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Run this command twice to generate two different secrets.

## How to Set on Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with the appropriate value
4. Redeploy the project

## Troubleshooting

If you see "There was a problem with the server configuration" error:

1. Verify all required environment variables are set on Vercel
2. Ensure `AUTH_SECRET` is set (at least 32 characters) for Production
3. Set `AUTH_URL` to the public `https://` deployment origin
4. Check Vercel deployment logs for specific errors

If login returns to `/login` with no error message:

1. Confirm `AUTH_SECRET` matches between Auth.js and middleware (redeploy after setting it)
2. Confirm `DATABASE_URL` is PostgreSQL and the demo administrator was created with `npm run demo:create`
3. Confirm middleware uses `secureCookie` for HTTPS (`__Secure-authjs.session-token`)
