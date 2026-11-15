import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { addDays, addMinutes } from "date-fns";
import { createPrismaClient } from "../src/lib/prisma-client";
import { decimalFromCents } from "../src/lib/money";
import { loadProjectEnv } from "../scripts/load-env";
import { demoMachineCode } from "./demo-fixtures";
import { ensureCatalog } from "./catalog";

loadProjectEnv();

const prisma = createPrismaClient();
const TENANT = "production";
const FEATURES = JSON.stringify({
  maxDevices: 2,
  monthlyExportLimit: 40,
  unlimitedExports: false,
  maxStorageMb: 8192,
  maxResolution: "hd",
  maxVideoMinutes: 45,
  premiumFeatures: false,
});

const PLANS = [
  { id: "sample_plan_studio", name: "Studio", durationDays: 30, priceCents: 490000 },
  { id: "sample_plan_atelier", name: "Atelier", durationDays: 90, priceCents: 1290000 },
  { id: "sample_plan_archive", name: "Archive", durationDays: 365, priceCents: 3990000 },
] as const;

const ACCOUNTS = [
  { n: 1, name: "Meera Shah", email: "meera.shah@example.com", phone: "9820011101", company: "Shah Gems", city: "Mumbai", plan: 0, status: "ACTIVE", sub: "ACTIVE", expiryDays: 5, createdDays: 18, loginDays: 1 },
  { n: 2, name: "Arjun Patel", email: "arjun.patel@example.com", phone: "9820011102", company: "Patel Atelier", city: "Jaipur", plan: 1, status: "ACTIVE", sub: "ACTIVE", expiryDays: 48, createdDays: 40, loginDays: 2 },
  { n: 3, name: "Kavya Nair", email: "kavya.nair@example.com", phone: "9820011103", company: "Nair Diamonds", city: "Kochi", plan: 2, status: "ACTIVE", sub: "ACTIVE", expiryDays: 200, createdDays: 70, loginDays: 4 },
  { n: 4, name: "Rohan Iyer", email: "rohan.iyer@example.com", phone: "9820011104", company: "Iyer Stones", city: "Pune", plan: 0, status: "ACTIVE", sub: "TRIAL", expiryDays: 12, createdDays: 6, loginDays: 1 },
  { n: 5, name: "Leela Kapoor", email: "leela.kapoor@example.com", phone: "9820011105", company: "Kapoor House", city: "Delhi", plan: 1, status: "SUSPENDED", sub: "SUSPENDED", expiryDays: 20, createdDays: 55, loginDays: 21 },
  { n: 6, name: "Dev Malhotra", email: "dev.malhotra@example.com", phone: "9820011106", company: "Malhotra Exports", city: "Surat", plan: 0, status: "ACTIVE", sub: "EXPIRED", expiryDays: -4, createdDays: 80, loginDays: 12 },
  { n: 7, name: "Anika Bose", email: "anika.bose@example.com", phone: "9820011107", company: "Bose Studio", city: "Kolkata", plan: 2, status: "ACTIVE", sub: "ACTIVE", expiryDays: 90, createdDays: 3, loginDays: 0 },
  { n: 8, name: "Vikram Desai", email: "vikram.desai@example.com", phone: "9820011108", company: "Desai Lab", city: "Ahmedabad", plan: 0, status: "ACTIVE", sub: "ACTIVE", expiryDays: 22, createdDays: 27, loginDays: 8 },
] as const;

function id(prefix: string, n: number) {
  return `${prefix}_${String(n).padStart(2, "0")}`;
}

async function main() {
  await ensureCatalog(prisma);
  const now = new Date();
  const passwordHash = await hash(randomBytes(24).toString("hex"), 12);

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: "Sample catalog plan.",
        durationDays: plan.durationDays,
        priceCents: plan.priceCents,
        priceAmount: decimalFromCents(plan.priceCents),
        currency: "INR",
        featuresJson: FEATURES,
        tenant: TENANT,
        status: "ACTIVE",
        deletedAt: null,
      },
      create: {
        id: plan.id,
        name: plan.name,
        description: "Sample catalog plan.",
        durationDays: plan.durationDays,
        priceCents: plan.priceCents,
        priceAmount: decimalFromCents(plan.priceCents),
        currency: "INR",
        featuresJson: FEATURES,
        tenant: TENANT,
        status: "ACTIVE",
      },
    });
  }

  for (const account of ACCOUNTS) {
    const customerId = id("sample_customer", account.n);
    const createdAt = addDays(now, -account.createdDays);
    const lastLoginAt = addDays(now, -account.loginDays);
    await prisma.customer.upsert({
      where: { id: customerId },
      update: {
        name: account.name,
        email: account.email,
        phone: account.phone,
        status: account.status,
        tenant: TENANT,
        source: "SAMPLE",
        emailVerified: account.n % 2 === 0,
        lastLoginAt,
        createdAt,
        deletedAt: null,
      },
      create: {
        id: customerId,
        name: account.name,
        email: account.email,
        phone: account.phone,
        passwordHash,
        status: account.status,
        tenant: TENANT,
        source: "SAMPLE",
        emailVerified: account.n % 2 === 0,
        lastLoginAt,
        createdAt,
      },
    });
    await prisma.customerProfile.upsert({
      where: { customerId },
      update: { company: account.company, city: account.city, notes: "Sample account for the dashboard." },
      create: { customerId, company: account.company, city: account.city, notes: "Sample account for the dashboard." },
    });

    const plan = PLANS[account.plan];
    const startDate = createdAt;
    const expiryDate = addDays(now, account.expiryDays);
    const used = account.n === 1 ? 28 : account.n === 8 ? 2 : 8 + account.n;
    await prisma.subscription.upsert({
      where: { id: id("sample_sub", account.n) },
      update: {
        customerId,
        planId: plan.id,
        status: account.sub,
        startDate,
        expiryDate,
        renewalDate: expiryDate,
        exportAllowance: 40,
        exportsUsed: used,
        creditsRemaining: Math.max(0, 40 - used),
        snapshotFeaturesJson: FEATURES,
        tenant: TENANT,
      },
      create: {
        id: id("sample_sub", account.n),
        customerId,
        planId: plan.id,
        status: account.sub,
        startDate,
        expiryDate,
        renewalDate: expiryDate,
        exportAllowance: 40,
        exportsUsed: used,
        creditsRemaining: Math.max(0, 40 - used),
        snapshotFeaturesJson: FEATURES,
        tenant: TENANT,
        createdAt,
      },
    });
    await prisma.subscriptionHistory.upsert({
      where: { id: id("sample_sub_history", account.n) },
      update: { status: account.sub, recordedAt: startDate },
      create: {
        id: id("sample_sub_history", account.n),
        subscriptionId: id("sample_sub", account.n),
        planId: plan.id,
        tenant: TENANT,
        status: account.sub,
        snapshotFeaturesJson: FEATURES,
        priceAmount: decimalFromCents(plan.priceCents),
        priceCents: plan.priceCents,
        reason: "Sample subscription opened",
        recordedAt: startDate,
      },
    });

    const paymentStatus = account.n === 5 ? "FAILED" : account.n === 6 ? "REFUNDED" : account.n === 4 ? "PENDING" : "PAID";
    const paidAt = paymentStatus === "PAID" || paymentStatus === "REFUNDED" ? addDays(now, -account.createdDays + 1) : null;
    await prisma.payment.upsert({
      where: { id: id("sample_payment", account.n) },
      update: {
        status: paymentStatus,
        amountCents: plan.priceCents,
        amount: decimalFromCents(plan.priceCents),
        paidAt,
        createdAt: paidAt ?? createdAt,
        simulated: false,
      },
      create: {
        id: id("sample_payment", account.n),
        tenant: TENANT,
        customerId,
        subscriptionId: id("sample_sub", account.n),
        amountCents: plan.priceCents,
        amount: decimalFromCents(plan.priceCents),
        currency: "INR",
        status: paymentStatus,
        method: "UPI",
        reference: `SAMPLE-INV-${String(account.n).padStart(4, "0")}`,
        invoiceNumber: `INV-2026-${String(account.n).padStart(4, "0")}`,
        simulated: false,
        paidAt,
        createdAt: paidAt ?? createdAt,
      },
    });
    if (paymentStatus === "REFUNDED") {
      await prisma.refund.upsert({
        where: { id: id("sample_refund", account.n) },
        update: { status: "COMPLETED" },
        create: {
          id: id("sample_refund", account.n),
          tenant: TENANT,
          paymentId: id("sample_payment", account.n),
          amountCents: plan.priceCents,
          amount: decimalFromCents(plan.priceCents),
          currency: "INR",
          status: "COMPLETED",
          reason: "Sample refund",
          simulated: false,
          createdAt: addDays(now, -2),
        },
      });
    }

    await prisma.loginEvent.upsert({
      where: { id: id("sample_login", account.n) },
      update: { success: true, createdAt: lastLoginAt },
      create: {
        id: id("sample_login", account.n),
        tenant: TENANT,
        actorType: "CUSTOMER",
        actorId: customerId,
        email: account.email,
        success: account.n !== 5,
        method: "PASSWORD",
        customerId,
        createdAt: lastLoginAt,
      },
    });
    await prisma.activityLog.upsert({
      where: { id: id("sample_activity", account.n) },
      update: { createdAt },
      create: {
        id: id("sample_activity", account.n),
        event: "CUSTOMER_CREATED",
        actorType: "ADMIN",
        actorEmail: "admin@aig.local",
        adminRole: "SUPER_ADMIN",
        targetType: "CUSTOMER",
        targetId: customerId,
        customerId,
        result: "SUCCESS",
        tenant: TENANT,
        createdAt,
      },
    });
  }

  const machineStates = [
    { n: 1, customer: 1, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 2, verified: true },
    { n: 2, customer: 1, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 4, verified: true },
    { n: 3, customer: 2, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 60 * 24 * 2, verified: true },
    { n: 4, customer: 3, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 8, verified: true },
    { n: 5, customer: 4, status: "ASSIGNED", health: "UNKNOWN", seenMinutes: 60 * 24 * 6, verified: false },
    { n: 6, customer: 5, status: "SUSPENDED", health: "ATTENTION", seenMinutes: 60 * 24 * 9, verified: true },
    { n: 7, customer: 7, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 60 * 30, verified: true },
    { n: 8, customer: 8, status: "ASSIGNED", health: "HEALTHY", seenMinutes: 60 * 24 * 4, verified: true },
    { n: 9, customer: null, status: "UNASSIGNED", health: "UNKNOWN", seenMinutes: null, verified: false },
    { n: 10, customer: null, status: "UNASSIGNED", health: "UNKNOWN", seenMinutes: null, verified: false },
  ] as const;

  for (const machine of machineStates) {
    const machineDbId = id("sample_machine", machine.n);
    const machineId = demoMachineCode(40 + machine.n);
    const customerId = machine.customer ? id("sample_customer", machine.customer) : null;
    const lastSeenAt = machine.seenMinutes == null ? null : addMinutes(now, -machine.seenMinutes);
    await prisma.machine.upsert({
      where: { id: machineDbId },
      update: {
        machineId,
        customerId,
        status: machine.status,
        healthStatus: machine.health,
        firmwareVersion: "2.4.1",
        model: "DiamondCam",
        serialNumber: `DC-2026-${String(machine.n).padStart(4, "0")}`,
        hardwareRevision: "C",
        lastSeenAt,
        telemetryVerified: machine.verified,
        telemetrySimulated: false,
        tenant: TENANT,
        deletedAt: null,
      },
      create: {
        id: machineDbId,
        machineId,
        customerId,
        status: machine.status,
        healthStatus: machine.health,
        firmwareVersion: "2.4.1",
        model: "DiamondCam",
        serialNumber: `DC-2026-${String(machine.n).padStart(4, "0")}`,
        hardwareRevision: "C",
        lastSeenAt,
        telemetryVerified: machine.verified,
        telemetrySimulated: false,
        tenant: TENANT,
        motorConfig: JSON.stringify({ speed: 40, direction: "cw" }),
        lightingConfig: JSON.stringify({ brightness: 70, temperature: 4500 }),
      },
    });
    await prisma.machineFirmwareHistory.upsert({
      where: { id: id("sample_firmware", machine.n) },
      update: { version: "2.4.1" },
      create: { id: id("sample_firmware", machine.n), machineId: machineDbId, version: "2.4.1", source: "SAMPLE", recordedAt: addDays(now, -20) },
    });
    await prisma.machineConfigRevision.upsert({
      where: { id: id("sample_config", machine.n) },
      update: {},
      create: {
        id: id("sample_config", machine.n),
        machineId: machineDbId,
        motorConfig: JSON.stringify({ speed: 40, direction: "cw" }),
        lightingConfig: JSON.stringify({ brightness: 70, temperature: 4500 }),
        recordedAt: addDays(now, -12),
      },
    });
    if (machine.customer) {
      await prisma.machineAssignment.upsert({
        where: { id: id("sample_assignment", machine.n) },
        update: { customerId, status: machine.status === "SUSPENDED" ? "ENDED" : "ACTIVE", unassignedAt: machine.status === "SUSPENDED" ? addDays(now, -3) : null },
        create: {
          id: id("sample_assignment", machine.n),
          machineId: machineDbId,
          customerId: customerId!,
          tenant: TENANT,
          assignedAt: addDays(now, -15),
          status: machine.status === "SUSPENDED" ? "ENDED" : "ACTIVE",
          unassignedAt: machine.status === "SUSPENDED" ? addDays(now, -3) : null,
        },
      });
    }
  }

  await prisma.machineError.upsert({
    where: { id: "sample_error_06" },
    update: { message: "Turntable motor stalled during the last capture." },
    create: {
      id: "sample_error_06",
      machineId: id("sample_machine", 6),
      tenant: TENANT,
      code: "MOTOR_STALL",
      message: "Turntable motor stalled during the last capture.",
      createdAt: addDays(now, -3),
    },
  });

  for (const account of ACCOUNTS) {
    const customerId = id("sample_customer", account.n);
    const machine = machineStates.find((row) => row.customer === account.n);
    for (let day = 0; day < 8; day += 1) {
      const n = account.n * 10 + day;
      const when = addDays(now, -((account.n * 3 + day * 4) % 28));
      const failed = day === 7;
      const key = id("sample_usage", n);
      await prisma.usageEntry.upsert({
        where: { id: key },
        update: { status: failed ? "FAILED" : "SUCCESS", createdAt: when, startedAt: when },
        create: {
          id: key,
          tenant: TENANT,
          customerId,
          machineId: machine ? id("sample_machine", machine.n) : null,
          jobId: `sample-job-${account.n}-${day}`,
          idempotencyKey: `sample:usage:${account.n}:${day}`,
          sourceRecording: failed ? null : `recording-${account.n}-${day}`,
          preset: "studio-spin",
          status: failed ? "FAILED" : "SUCCESS",
          startedAt: when,
          completedAt: addMinutes(when, failed ? 1 : 6),
          durationMs: failed ? 4000 : 12000 + day * 3000,
          creditsConsumed: failed ? 0 : 1,
          storageMb: failed ? 0 : 80 + day * 12,
          exportDate: failed ? null : when,
          outputRef: failed ? null : `export-${account.n}-${day}`,
          failureReason: failed ? "Sample processing failure" : null,
          charged: !failed,
          createdAt: when,
        },
      });
    }
  }

  const customers = await prisma.customer.count({ where: { tenant: TENANT, id: { startsWith: "sample_customer_" } } });
  const machines = await prisma.machine.count({ where: { tenant: TENANT, id: { startsWith: "sample_machine_" } } });
  const usage = await prisma.usageEntry.count({ where: { tenant: TENANT, id: { startsWith: "sample_usage_" } } });
  console.log(`[sample] Accounts ${customers}, machines ${machines}, usage rows ${usage}.`);
}

main()
  .catch((error: unknown) => {
    console.error("[sample] Failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
