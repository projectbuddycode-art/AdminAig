# Demo login

The demo administrator belongs only to the AIG Demo Tenant (`tenant = demo`). Sign-in uses the normal `/login` page. After login the dashboard shows a Demo environment banner and loads only that tenant's rows.

The password is read from `DEMO_ADMIN_PASSWORD`. It is hashed with bcrypt and is not printed, returned by an API, or stored in git.

## One-time setup on the Vercel database

Run this from a workstation. The Vercel build does not run it. There is no public account-creation route.

Set the shell variables, including the Supabase URLs already configured for the deployment:

```powershell
$env:DEMO_TENANT_ENABLED = "true"
$env:DEMO_ADMIN_EMAIL = "projectbuddy.code@gmail.com"
$env:DEMO_ADMIN_PASSWORD = "<12 or more characters>"
$env:DATABASE_URL = "<pooled Supabase URL>"
$env:DIRECT_URL = "<direct Supabase URL>"
npx prisma migrate deploy
npm run demo:create
```

```bash
DEMO_TENANT_ENABLED=true \
DEMO_ADMIN_EMAIL=projectbuddy.code@gmail.com \
DEMO_ADMIN_PASSWORD='<12 or more characters>' \
DATABASE_URL='<pooled Supabase URL>' \
DIRECT_URL='<direct Supabase URL>' \
npx prisma migrate deploy && npm run demo:create
```

The command creates the AIG Demo Tenant and the `DEMO_ADMIN` account when they are missing. Running it again reports that the account exists and leaves the password unchanged.

Do not set `VERCEL=1` in that shell. The script refuses to run inside Vercel so a build cannot create or reset the account.

On Vercel, store `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, and `DEMO_TENANT_ENABLED` as server environment variables. Do not use a `NEXT_PUBLIC_` prefix. The running site authenticates with the hash in the database; page requests do not create the account.

## Password reset

Set `DEMO_ADMIN_PASSWORD` to the new password in the shell, with the same database URLs and `DEMO_TENANT_ENABLED=true`, then:

```bash
npm run demo:reset-password
```

That is the only command that replaces an existing demo administrator password.

## Synthetic records

`npm run db:seed:demo` still requires `DEMO_MODE=true` and refuses `AIG_RUNTIME=production`. It fills the demo tenant with synthetic customers and machines. It does not rotate the administrator password.

## What the account can do

The signed-in demo administrator can open the dashboard, customers, machines, subscriptions, usage, payments, and reports for the demo tenant. Server queries use the tenant stored on the administrator row. A changed URL or id does not reveal production rows. The account cannot record a payment, send a live notification, or mark a demo machine as a verified production device.
