# Database deployment

Prisma is 6.16.3. Migrations live in `prisma/migrations` and target PostgreSQL. Do not run `prisma migrate reset`, `prisma db push --accept-data-loss`, or any command that drops tables on a database that holds real customers.

## 1. Create the Supabase database

Create a Supabase project and copy two connection strings from Project Settings → Database:

- **Transaction pooler** (port 6543) → `DATABASE_URL`
- **Direct connection** (port 5432) → `DIRECT_URL`

Append `sslmode=require` to both. Add `pgbouncer=true&connection_limit=1` to the pooled URL only. Do not put these values in git.

## 2. Apply migrations

From a workstation that has the repository and the two URLs:

```bash
npx prisma migrate deploy
```

This applies the committed SQL. It does not seed data and it does not reset the schema.

Confirm connectivity without printing secrets:

```bash
npm run db:health
```

A successful check prints `Connection succeeded.`

## 3. Create the production administrator

Set `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 12 characters in the shell, not in a committed file. Then:

```bash
npm run db:seed
```

The command upserts the production administrator, the production and demo tenant rows, and the role catalog. It does not create customers, payments, or demo business data. The password is not printed. Run it again to rotate the password; it will not duplicate the account.

## 4. Schema changes later

1. Edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name describe_the_change` against a disposable database.
3. Commit the new folder under `prisma/migrations`.
4. On Supabase, run `npx prisma migrate deploy`.

Review the generated SQL before deploying. Do not edit a migration that has already been applied to Supabase.

## 5. Backups

Enable Supabase Point-in-Time Recovery or daily backups before inviting real customers. Take a manual backup before `migrate deploy` on a database that already contains production data. Restore drills belong in the Supabase project, not in this repository.

## 6. Local verification database

`scripts/verify-disposable-db.ts` starts a disposable PostgreSQL, applies the committed migration, seeds the demo tenant twice, and runs the database test files. It is not part of the Vercel build. Install `embedded-postgres` locally before running it; that package is not a production dependency. The script is excluded from `tsc` for that reason.

Database tests refuse a `supabase.com` URL. For a disposable local database:

```bash
docker run --name aig-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aig_test -p 54329:5432 -d postgres:16
```

Then set `TEST_DATABASE_URL` and `DIRECT_URL` to `postgresql://postgres:postgres@localhost:54329/aig_test` and run `npm test`. That URL is local test infrastructure, not the production database.
