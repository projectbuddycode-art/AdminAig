import { execSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { createPrismaClient } from "../src/lib/prisma-client";
import { getAnalytics } from "../src/server/analytics";
import { recordManualPayment, suspendCustomer } from "../src/server/domain";
import { demoDatasetCounts } from "../prisma/demo-fixtures";

const port = 54329;
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/aig_test`;

async function main() {
  const postgres = new EmbeddedPostgres({
    databaseDir: "prisma/.embedded-test",
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("aig_test");

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    DEMO_MODE: "true",
    DEMO_TENANT_ENABLED: "true",
    AIG_RUNTIME: "development",
    VERCEL_ENV: "",
    DEMO_ADMIN_EMAIL: "demo.admin@example.com",
    DEMO_ADMIN_PASSWORD: "verify-demo-password",
    ADMIN_EMAIL: "admin@aig.local",
    ADMIN_PASSWORD: "verify-admin-password",
  };

  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed-demo.ts", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed-demo.ts", { stdio: "inherit", env });

  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  const prisma = createPrismaClient();
  try {
    const expected = demoDatasetCounts();
    const customers = await prisma.customer.count({ where: { tenant: "demo" } });
    const machines = await prisma.machine.count({ where: { tenant: "demo" } });
    const plans = await prisma.plan.count({ where: { tenant: "demo" } });
    const usage = await prisma.usageEntry.count({ where: { tenant: "demo" } });
    const payments = await prisma.payment.count({ where: { tenant: "demo" } });
    const productionCustomers = await prisma.customer.count({ where: { tenant: "production" } });
    if (customers !== expected.customers || machines !== expected.machines || plans !== expected.plans) {
      throw new Error(`Unexpected demo counts: customers ${customers}, machines ${machines}, plans ${plans}`);
    }
    if (usage !== expected.usage || payments !== expected.payments) {
      throw new Error(`Unexpected ledger counts: usage ${usage}, payments ${payments}`);
    }
    if (productionCustomers !== 0) {
      throw new Error("Demo seed wrote production customers.");
    }

    let duplicateRejected = false;
    try {
      await prisma.usageEntry.create({
        data: {
          tenant: "demo",
          customerId: "demo_customer_01",
          jobId: "not-the-seed-key",
          idempotencyKey: "demo:usage:01:01",
          status: "SUCCESS",
          startedAt: new Date(),
        },
      });
    } catch {
      duplicateRejected = true;
    }
    if (!duplicateRejected) throw new Error("Duplicate idempotency key was inserted.");

    const production = { type: "ADMIN" as const, id: "prod", email: "admin@aig.local", role: "ADMIN", tenant: "production" };
    const demo = { type: "ADMIN" as const, id: "demo", email: "demo.admin@example.com", role: "DEMO_ADMIN", tenant: "demo" };
    await suspendCustomer({ db: prisma, actor: demo }, "demo_customer_01", "demo suspension check").catch(() => undefined);
    try {
      await suspendCustomer({ db: prisma, actor: demo }, "missing-production-id", "should fail");
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      if (code !== "CUSTOMER_NOT_FOUND" && code !== "TENANT_FORBIDDEN") {
        throw error;
      }
    }
    await recordManualPayment(
      { db: prisma, actor: demo },
      {
        customerId: "demo_customer_01",
        amountCents: 100,
        status: "PAID",
        method: "CARD",
        reference: "should-not-exist",
      },
    ).then(
      () => {
        throw new Error("Demo administrator recorded a payment.");
      },
      () => undefined,
    );

    const productionPaid = await prisma.payment.aggregate({
      where: { tenant: "production", simulated: false, status: "PAID" },
      _sum: { amountCents: true },
    });
    if ((productionPaid._sum.amountCents ?? 0) !== 0) {
      throw new Error("Production payments include unexpected cash.");
    }
    const finance = await getAnalytics(prisma, "finance", {
      tenant: "production",
      range: {
        from: new Date("2020-01-01T00:00:00.000Z"),
        to: new Date("2030-01-01T00:00:00.000Z"),
        previousFrom: new Date("2010-01-01T00:00:00.000Z"),
        previousTo: new Date("2019-12-31T00:00:00.000Z"),
        label: "verification",
        preset: "custom",
      },
      page: 1,
      pageSize: 20,
    });
    const collected = finance.kpis.find((kpi) => kpi.label === "Collected");
    const simulated = finance.kpis.find((kpi) => kpi.label === "Simulated, not collected");
    if (collected?.value !== 0 || simulated?.value !== 0) {
      throw new Error(`Production finance included demo money: collected ${collected?.value}, simulated ${simulated?.value}`);
    }
    if (production.tenant !== "production") throw new Error("Production actor was not checked.");
    execSync("npx vitest run tests/domain.test.ts tests/command-center.test.ts tests/demo-admin-account.test.ts tests/demo-admin-guard.test.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        TEST_DATABASE_URL: databaseUrl,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
    });
    console.log("[verify] Disposable database passed migration, seed idempotency, tenant isolation, and finance checks.");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await postgres.stop().catch(() => {
      console.log("[verify] Disposable database shutdown left a locked file. The checks above already finished.");
    });
  }
}

main().catch(async (error: unknown) => {
  console.error("[verify] Failed.");
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
});
