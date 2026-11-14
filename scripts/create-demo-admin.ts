import { hash } from "bcryptjs";
import { addDays } from "date-fns";
import { createPrismaClient } from "../src/lib/prisma-client";

const prisma = createPrismaClient();

function refuse(message: string): never {
  console.error(`[demo] ${message}`);
  process.exit(1);
}

async function main() {
  if (process.env.DEMO_MODE !== "true") {
    refuse("Set DEMO_MODE=true. This script only runs in a designated demo environment.");
  }
  if (process.env.AIG_RUNTIME === "production" || process.env.VERCEL_ENV === "production") {
    refuse("Production mode is active. Demo data was not created.");
  }

  const email = (process.env.DEMO_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD ?? "";
  if (!email || !email.endsWith("@example.com")) {
    refuse("DEMO_ADMIN_EMAIL must be set and use the example.com domain.");
  }
  if (password.length < 8) {
    refuse("DEMO_ADMIN_PASSWORD must be set and be at least 8 characters. It is not printed.");
  }

  const passwordHash = await hash(password, 10);
  await prisma.admin.upsert({
    where: { email },
    update: { name: "Demo Administrator", passwordHash, role: "DEMO_ADMIN", status: "ACTIVE", tenant: "demo" },
    create: { name: "Demo Administrator", email, passwordHash, role: "DEMO_ADMIN", status: "ACTIVE", tenant: "demo" },
  });

  const auditorEmail = (process.env.DEMO_AUDITOR_EMAIL ?? "").trim().toLowerCase();
  const auditorPassword = process.env.DEMO_AUDITOR_PASSWORD ?? "";
  if (auditorEmail && auditorPassword.length >= 8) {
    const auditorHash = await hash(auditorPassword, 10);
    await prisma.admin.upsert({
      where: { email: auditorEmail },
      update: { name: "Demo Auditor", passwordHash: auditorHash, role: "AUDITOR", status: "ACTIVE", tenant: "demo" },
      create: { name: "Demo Auditor", email: auditorEmail, passwordHash: auditorHash, role: "AUDITOR", status: "ACTIVE", tenant: "demo" },
    });
  }

  const existing = await prisma.customer.count({ where: { tenant: "demo" } });
  if (existing === 0) {
    const now = new Date();
    const features = JSON.stringify({
      maxDevices: 1,
      monthlyExportLimit: 20,
      unlimitedExports: false,
      maxStorageMb: 2048,
      maxResolution: "hd",
      maxVideoMinutes: 30,
      premiumFeatures: false,
    });
    const plans = await Promise.all(
      [
        ["Studio", 30, 490000],
        ["Atelier", 90, 1290000],
        ["Archive", 365, 3990000],
      ].map(([name, days, price]) =>
        prisma.plan.create({
          data: {
            name: `DEMO ${name}`,
            description: "DEMO DATA plan",
            durationDays: Number(days),
            priceCents: Number(price),
            featuresJson: features,
            tenant: "demo",
            status: "ACTIVE",
          },
        }),
      ),
    );

    for (let i = 1; i <= 24; i += 1) {
      const plan = plans[i % plans.length];
      const createdAt = addDays(now, -((i * 9) % 120));
      const expired = i % 7 === 0;
      const suspended = i % 11 === 0;
      const customer = await prisma.customer.create({
        data: {
          name: `Demo Customer ${i}`,
          email: `demo.customer.${i}@example.com`,
          phone: `90000000${String(i).padStart(2, "0")}`,
          passwordHash,
          status: suspended ? "SUSPENDED" : "ACTIVE",
          tenant: "demo",
          demoLabel: "DEMO DATA",
          source: "DEMO_SEED",
          emailVerified: i % 2 === 0,
          lastLoginAt: addDays(now, -(i % 20)),
          createdAt,
        },
      });
      const start = createdAt;
      const expiry = expired ? addDays(now, -3) : addDays(now, (i % 40) + 1);
      const allowance = 20;
      const used = i % 18;
      await prisma.subscription.create({
        data: {
          customerId: customer.id,
          planId: plan.id,
          status: suspended ? "SUSPENDED" : expired ? "EXPIRED" : "ACTIVE",
          startDate: start,
          expiryDate: expiry,
          renewalDate: expiry,
          exportAllowance: allowance,
          exportsUsed: used,
          creditsRemaining: Math.max(0, allowance - used),
          snapshotFeaturesJson: features,
          tenant: "demo",
        },
      });
      await prisma.payment.create({
        data: {
          tenant: "demo",
          customerId: customer.id,
          amountCents: plan.priceCents,
          status: i % 5 === 0 ? "PENDING" : "PAID",
          method: "SIMULATED",
          reference: `DEMO-${i}`,
          invoiceNumber: `DEMO-INV-${i}`,
          simulated: true,
          demoLabel: "DEMO DATA",
          paidAt: i % 5 === 0 ? null : createdAt,
        },
      });
    }

    const customers = await prisma.customer.findMany({ where: { tenant: "demo" }, take: 6 });
    for (let i = 1; i <= 8; i += 1) {
      const owner = i <= 6 ? customers[i - 1] : null;
      const fresh = i === 1;
      await prisma.machine.create({
        data: {
          machineId: `AIG-DM${"ABCDEFGH"[i - 1]}2-X${"ABCDEFGH"[i - 1]}32`,
          status: owner ? "ASSIGNED" : "UNASSIGNED",
          customerId: owner?.id,
          firmwareVersion: i % 2 === 0 ? "1.4.2" : "1.3.9",
          model: "DiamondCam",
          serialNumber: `DEMO-SN-${i}`,
          hardwareRevision: "D",
          healthStatus: i === 4 ? "ATTENTION" : "OK",
          tenant: "demo",
          demoLabel: "DEMO DATA",
          telemetryVerified: fresh,
          telemetrySimulated: fresh,
          lastSeenAt: fresh ? now : addDays(now, -2),
        },
      });
    }

    const demoCustomers = await prisma.customer.findMany({ where: { tenant: "demo" }, take: 4 });
    for (const [index, customer] of demoCustomers.entries()) {
      await prisma.usageEntry.create({
        data: {
          tenant: "demo",
          customerId: customer.id,
          jobId: `demo-job-${index}`,
          idempotencyKey: `demo-job-${index}`,
          status: index === 2 ? "FAILED" : "SUCCESS",
          startedAt: now,
          completedAt: now,
          durationMs: 12000 + index * 1000,
          creditsConsumed: index === 2 ? 0 : 1,
          charged: index !== 2,
          failureReason: index === 2 ? "DEMO DATA sample failure" : null,
        },
      });
      await prisma.notificationMessage.create({
        data: {
          tenant: "demo",
          customerId: customer.id,
          channel: "EMAIL",
          templateKey: "renewal",
          subject: "DEMO DATA renewal reminder",
          body: "Simulated reminder. No message was delivered.",
          status: "SIMULATED",
          simulated: true,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        event: "CUSTOMER_CREATED",
        actorType: "SYSTEM",
        actorEmail: "demo-seed@example.com",
        adminRole: "SYSTEM",
        targetType: "TENANT",
        targetId: "demo",
        tenant: "demo",
        reason: "Demo environment seed",
        newValue: JSON.stringify({ customers: 24, label: "DEMO DATA" }),
        result: "SUCCESS",
      },
    });
  }

  console.log(`[demo] Demo administrator ready: ${email}`);
  console.log("[demo] Password was taken from DEMO_ADMIN_PASSWORD and is not printed.");
  console.log("[demo] Sign in at /login. The account is limited to the demo tenant.");
  if (auditorEmail && auditorPassword.length >= 8) {
    console.log(`[demo] Read-only demo auditor ready: ${auditorEmail}`);
  } else {
    console.log("[demo] Optional second account: set DEMO_AUDITOR_EMAIL and DEMO_AUDITOR_PASSWORD, then rerun.");
  }
}

main()
  .catch((error) => {
    console.error("[demo] Setup failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
