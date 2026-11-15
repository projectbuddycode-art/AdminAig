# Database architecture

AIG Admin uses PostgreSQL through Prisma 6.16. The application talks to the database with the `pg` driver adapter (`engineType = "client"`). SQLite is not a supported runtime.

## Connections

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Pooled connection for the Next.js server and scripts. On Supabase this is the transaction pooler (port 6543) with `pgbouncer=true`. |
| `DIRECT_URL` | Direct connection used by `prisma migrate`. On Supabase this is port 5432. |

The server keeps a single connection in the pool (`max: 1`) and reuses it across warm serverless invocations. Request handlers do not open a new pool. Logs record a connection failure code and do not print the connection string.

`GET /api/health` runs `SELECT 1`. A database failure returns HTTP 503 with `database: "down"` and no error detail.

## Tenants

Two tenant keys exist:

- `production` — customer, subscription, payment, machine, and usage rows for the live business.
- `demo` — synthetic rows for presentations.

Every business table that can appear in a report stores `tenant`. Dashboard queries, CSV exports, and server actions take the signed-in administrator's tenant from the database. A demo administrator who changes an id, query string, or request body still fails the tenant check (`TENANT_FORBIDDEN`) or receives an empty result.

Demo payments are stored with `simulated = true`. Production revenue totals ignore simulated payments and ignore every row whose tenant is not `production`.

Demo machine heartbeats stay marked simulated. Demo administrators cannot record payments. Demo notification rows are stored as simulated and are not handed to a provider.

## Money and time

Plan prices, payments, and refunds store both integer cents and `DECIMAL(12,2)` major units. The decimal value is the fixed-point form of the cents (`490000` cents is `4900.00`). Timestamps are `timestamptz` and are written in UTC.

## Ledger

`UsageEntry.idempotencyKey` is unique. Repeating the same key returns the original row and does not decrement credits again. The same key is stored on `ExportRecord`. `ProcessingJob.jobKey` is unique per tenant.

`SubscriptionHistory` stores the plan price and feature snapshot when a subscription is opened or replaced. Later plan edits do not rewrite those rows.

## Soft deletion

Customers, machines, plans, admins, profiles, and support tickets have `deletedAt`. List and dashboard queries hide rows where `deletedAt` is set. Login rejects a soft-deleted administrator.

## What this document does not claim

Supabase and Vercel are not configured by the repository. They become active only after the environment variables in the deployment guide are set on those services and the migration command is run against that database.
