import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";
import { AppError } from "@/lib/errors";
import { assignMachine, createCustomer, createMachine, createPlan, grantCredits, recordUsage, suspendCustomer } from "@/server/domain";
import { defaultPlanFeatures } from "@/lib/plan-features";
import { can } from "@/lib/rbac";
import { disposableDatabaseUrl, resetBusinessData } from "./reset-db";

const databaseUrl = disposableDatabaseUrl();
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
}

const production = { type: "ADMIN" as const, id: "prod-admin", email: "prod@test.local", role: "ADMIN", tenant: "production" };
const demo = { type: "ADMIN" as const, id: "demo-admin", email: "demo@example.com", role: "DEMO_ADMIN", tenant: "demo" };
const auditor = { type: "ADMIN" as const, id: "aud", email: "aud@test.local", role: "AUDITOR", tenant: "production" };

describe.skipIf(!databaseUrl)("tenant isolation and permissions", () => {
let prisma: PrismaClient;

beforeAll(() => {
  if (!databaseUrl) return;
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  });
  prisma = createPrismaClient();
});

beforeEach(async () => {
  await resetBusinessData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

  it("blocks a demo admin from changing a production customer", async () => {
    const plan = await createPlan(
      { db: prisma, actor: production },
      { name: "Studio", description: "Live", durationDays: 30, features: defaultPlanFeatures() },
    );
    const created = await createCustomer(
      { db: prisma, actor: production },
      { name: "Live", email: "live@test.local", phone: "9999999999", planId: plan.id, password: "password1" },
    );
    await expect(suspendCustomer({ db: prisma, actor: demo }, created.customer.id, "should fail")).rejects.toMatchObject({
      code: "TENANT_FORBIDDEN",
    });
  });

  it("blocks a read-only auditor from suspending a customer", async () => {
    const plan = await createPlan(
      { db: prisma, actor: production },
      { name: "Studio", description: "Live", durationDays: 30, features: defaultPlanFeatures() },
    );
    const created = await createCustomer(
      { db: prisma, actor: production },
      { name: "Live", email: "live2@test.local", phone: "9999999998", planId: plan.id, password: "password1" },
    );
    await expect(suspendCustomer({ db: prisma, actor: auditor }, created.customer.id, "nope")).rejects.toBeInstanceOf(AppError);
    expect(can("AUDITOR", "customers.edit")).toBe(false);
    expect(can("DEMO_ADMIN", "payments.reconcile")).toBe(false);
  });

  it("charges a successful export once when the same idempotency key is reused", async () => {
    const plan = await createPlan(
      { db: prisma, actor: production },
      {
        name: "Studio",
        description: "Live",
        durationDays: 30,
        features: { ...defaultPlanFeatures(), monthlyExportLimit: 5, unlimitedExports: false },
      },
    );
    const created = await createCustomer(
      { db: prisma, actor: production },
      { name: "Live", email: "usage@test.local", phone: "9999999997", planId: plan.id, password: "password1" },
    );
    const machine = await createMachine({ db: prisma, actor: production }, {});
    await assignMachine({ db: prisma, actor: production }, machine.id, created.customer.id);
    const input = {
      customerId: created.customer.id,
      jobId: "job-1",
      idempotencyKey: "job-1",
      status: "SUCCESS" as const,
    };
    const first = await recordUsage({ db: prisma, actor: production }, input);
    const second = await recordUsage({ db: prisma, actor: production }, input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    const subscription = await prisma.subscription.findFirst({ where: { customerId: created.customer.id, status: "ACTIVE" } });
    expect(subscription?.exportsUsed).toBe(1);
    expect(subscription?.creditsRemaining).toBe(4);
    const log = await prisma.activityLog.findFirst({ where: { event: "CREDITS_GRANTED" } });
    await grantCredits({ db: prisma, actor: production }, created.customer.id, 2, "complimentary demo adjustment");
    const after = await prisma.subscription.findFirst({ where: { id: subscription!.id } });
    expect(after?.creditsRemaining).toBe(6);
    expect(log).toBeNull();
    const creditLog = await prisma.activityLog.findFirst({ where: { event: "CREDITS_GRANTED" } });
    expect(creditLog?.reason).toBe("complimentary demo adjustment");
    expect(creditLog?.previousValue).toContain("4");
  });
});
