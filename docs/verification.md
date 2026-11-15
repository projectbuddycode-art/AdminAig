# Verification results

Checked on this workstation on 15 November 2026. Supabase and Vercel were not connected. Nothing here was deployed.

## Passed locally

| Check | Result |
| --- | --- |
| Prisma schema validates (`npx prisma validate`) | Passed. Provider is PostgreSQL. |
| Prisma Client generates (`npx prisma generate`, Prisma 6.16.3, `engineType = "client"`, `@prisma/adapter-pg`) | Passed. |
| TypeScript (`npx tsc --noEmit`) | Passed. |
| Production build (`npm run build`) | Passed. Dashboard routes are server-rendered. The build does not migrate or seed. |
| Unit tests without a database (`npx vitest run`) | 10 passed. Database suites skipped until `TEST_DATABASE_URL` is set. |
| Migration on a fresh database | Passed against a disposable local PostgreSQL 18 on `127.0.0.1:54329`. `20261115120000_postgresql_baseline` applied. This was not Supabase. The local cluster used the Windows locale encoding; Supabase projects use UTF8. The SQL uses `TEXT`, `DECIMAL(12,2)`, and `TIMESTAMPTZ`. |
| Demo seed, then the same seed again | Passed. Both runs reported 25 customers, 20 machines, 3 plans, and 99 usage rows. The second run did not increase those counts. |
| Usage idempotency | Passed. Inserting the existing key `demo:usage:01:01` was rejected by the unique constraint. |
| Demo payment guard | Passed. The demo administrator could not record a payment. |
| Production finance | Passed. Production collected cash and simulated cash were both 0 while the demo tenant held the simulated payments. |
| Existing domain and tenant tests | Passed on that same PostgreSQL: 12 tests in `tests/domain.test.ts` and `tests/command-center.test.ts`. |

## Not run

- A connection to a Supabase project.
- A Vercel deployment.
- A browser sign-in. The disposable database was stopped after the checks above.

## How to repeat the database checks

```bash
npm install --no-save embedded-postgres
npx tsx scripts/verify-disposable-db.ts
```

Point `TEST_DATABASE_URL` at any other disposable PostgreSQL to run `npm test` without the embedded package. Do not use a Supabase URL for that; the test helper refuses it.
