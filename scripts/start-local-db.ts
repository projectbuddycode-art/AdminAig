import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.LOCAL_PG_PORT || 54330);
const databaseDir = path.resolve("prisma/.embedded-dev");
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/aig`;

async function main() {
  mkdirSync(databaseDir, { recursive: true });
  const fresh = !existsSync(path.join(databaseDir, "PG_VERSION"));
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
  });

  if (fresh) {
    console.log("[local-db] Initialising embedded PostgreSQL…");
    await postgres.initialise();
  }

  console.log(`[local-db] Starting on 127.0.0.1:${port}…`);
  await postgres.start();

  try {
    await postgres.createDatabase("aig");
    console.log("[local-db] Created database aig.");
  } catch {
    console.log("[local-db] Database aig already exists.");
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    DEMO_TENANT_ENABLED: "true",
    DEMO_MODE: "true",
    AIG_RUNTIME: "development",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@aig.local",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "local-admin-password",
    ADMIN_NAME: process.env.ADMIN_NAME || "AIG Administrator",
    DEMO_ADMIN_EMAIL: process.env.DEMO_ADMIN_EMAIL || "projectbuddy.code@gmail.com",
    DEMO_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD || "Aigtestadminpassword",
  };

  console.log("[local-db] Applying migrations…");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  console.log("[local-db] Seeding administrator…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
  console.log("[local-db] Seeding sample dashboard data…");
  execSync("npx tsx prisma/seed-sample.ts", { stdio: "inherit", env });
  console.log("[local-db] Ready.");
  console.log(`[local-db] DATABASE_URL=${databaseUrl}`);
  console.log("[local-db] Keep this process running while you use npm run dev.");

  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error("[local-db] Failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
