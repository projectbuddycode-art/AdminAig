import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { compare } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";
import { createCustomer, createPlan, recordManualPayment, suspendCustomer } from "@/server/domain";
import { defaultPlanFeatures } from "@/lib/plan-features";
import { ensureDemoAdmin } from "../prisma/demo-admin";
import { disposableDatabaseUrl, resetBusinessData } from "./reset-db";

const databaseUrl = disposableDatabaseUrl();
const email = "projectbuddy.code@gmail.com";

describe.skipIf(!databaseUrl)("demo administrator account", () => {
  let prisma: PrismaClient;
  const password = `Verify-${randomBytes(18).toString("hex")}`;
  const replacement = `Reset-${randomBytes(18).toString("hex")}`;

  beforeAll(() => {
    if (!databaseUrl) return;
    process.env.DATABASE_URL = databaseUrl;
    process.env.DIRECT_URL = databaseUrl;
    delete process.env.VERCEL;
    delete process.env.NEXT_PHASE;
    process.env.DEMO_TENANT_ENABLED = "true";
    process.env.DEMO_ADMIN_EMAIL = email;
    process.env.DEMO_ADMIN_PASSWORD = password;
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    });
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("creates the account once, authenticates, and stays inside the demo tenant", async () => {
    const created = await ensureDemoAdmin(prisma);
    expect(created.created).toBe(true);
    expect(created.passwordUpdated).toBe(true);
    expect(created.email).toBe(email);

    const admin = await prisma.admin.findUniqueOrThrow({ where: { email } });
    expect(admin.role).toBe("DEMO_ADMIN");
    expect(admin.tenant).toBe("demo");
    expect(admin.passwordHash).not.toBe(password);
    expect(await compare(password, admin.passwordHash)).toBe(true);
    expect(await compare(`${password}-wrong`, admin.passwordHash)).toBe(false);

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { key: "demo" } });
    expect(tenant.name).toBe("AIG Demo Tenant");
    const memberships = await prisma.tenantMembership.findMany({ where: { adminId: admin.id }, include: { tenant: true } });
    expect(memberships.map((row) => row.tenant.key)).toEqual(["demo"]);

    const originalHash = admin.passwordHash;
    const second = await ensureDemoAdmin(prisma);
    expect(second.created).toBe(false);
    expect(second.passwordUpdated).toBe(false);
    const unchanged = await prisma.admin.findUniqueOrThrow({ where: { email } });
    expect(unchanged.passwordHash).toBe(originalHash);
    expect(await prisma.admin.count({ where: { email } })).toBe(1);

    const production = { type: "ADMIN" as const, id: "prod-admin", email: "prod@test.local", role: "ADMIN", tenant: "production" };
    const demo = { type: "ADMIN" as const, id: admin.id, email, role: "DEMO_ADMIN", tenant: "demo" };
    const plan = await createPlan(
      { db: prisma, actor: production },
      { name: "Live Studio", description: "Production", durationDays: 30, features: defaultPlanFeatures() },
    );
    const customer = await createCustomer(
      { db: prisma, actor: production },
      { name: "Live Customer", email: "live.customer@test.local", phone: "9999999999", planId: plan.id, password: "password1" },
    );
    await expect(suspendCustomer({ db: prisma, actor: demo }, customer.customer.id, "cross tenant")).rejects.toMatchObject({
      code: "TENANT_FORBIDDEN",
    });
    await expect(
      recordManualPayment(
        { db: prisma, actor: demo },
        { customerId: customer.customer.id, amountCents: 100, status: "PAID", method: "CARD", reference: "live-payment" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const demoPlan = await prisma.plan.create({
      data: {
        name: "AIG Demo Studio",
        durationDays: 30,
        tenant: "demo",
        featuresJson: "{}",
        priceCents: 0,
        priceAmount: "0.00",
      },
    });
    const demoCustomer = await createCustomer(
      { db: prisma, actor: demo },
      { name: "Synthetic Customer", email: "synthetic.customer@example.com", phone: "9000000001", planId: demoPlan.id, password: "password1" },
    );
    await expect(
      recordManualPayment(
        { db: prisma, actor: demo },
        { customerId: demoCustomer.customer.id, amountCents: 100, status: "PAID", method: "CARD", reference: "demo-payment" },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const visible = await prisma.customer.count({ where: { tenant: "demo", email: "live.customer@test.local" } });
    expect(visible).toBe(0);

    process.env.DEMO_ADMIN_PASSWORD = replacement;
    const reset = await ensureDemoAdmin(prisma, { resetPassword: true });
    expect(reset.passwordUpdated).toBe(true);
    const replaced = await prisma.admin.findUniqueOrThrow({ where: { email } });
    expect(await compare(replacement, replaced.passwordHash)).toBe(true);
    expect(await compare(password, replaced.passwordHash)).toBe(false);

    await resetBusinessData(prisma);
  });
});
