import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { createPrismaClient } from "../src/lib/prisma-client";
import { loadProjectEnv } from "../scripts/load-env";
import { ensureDemoAdmin } from "./demo-admin";
import { buildDemoDataset, demoDatasetCounts } from "./demo-fixtures";

loadProjectEnv();

const prisma = createPrismaClient();

async function customerPasswordHash(existing: string | null) {
  const configured = process.env.DEMO_CUSTOMER_PASSWORD ?? "";
  if (configured.length >= 12) return hash(configured, 12);
  if (existing) return existing;
  return hash(randomBytes(24).toString("hex"), 12);
}

async function main() {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Set DEMO_MODE=true. Demo seeding is a separate command and does not run during deployment.");
  }
  if (process.env.VERCEL_ENV === "production" || process.env.AIG_RUNTIME === "production") {
    throw new Error("Refusing to seed demo data while production runtime flags are set.");
  }

  const admin = await ensureDemoAdmin(prisma);
  const now = new Date();
  const data = buildDemoDataset(now);

  for (const plan of data.plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays,
        priceCents: plan.priceCents,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        featuresJson: plan.featuresJson,
        tenant: plan.tenant,
        status: plan.status,
        deletedAt: null,
      },
      create: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays,
        priceCents: plan.priceCents,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        featuresJson: plan.featuresJson,
        tenant: plan.tenant,
        status: plan.status,
      },
    });
  }

  for (const customer of data.customers) {
    const current = await prisma.customer.findUnique({ where: { id: customer.id }, select: { passwordHash: true } });
    const passwordHash = await customerPasswordHash(current?.passwordHash ?? null);
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        tenant: customer.tenant,
        demoLabel: customer.demoLabel,
        source: customer.source,
        emailVerified: customer.emailVerified,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
        passwordHash,
        deletedAt: null,
      },
      create: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        passwordHash,
        status: customer.status,
        tenant: customer.tenant,
        demoLabel: customer.demoLabel,
        source: customer.source,
        emailVerified: customer.emailVerified,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
      },
    });
    await prisma.customerProfile.upsert({
      where: { customerId: customer.id },
      update: { company: customer.company, city: customer.city, notes: "DEMO DATA profile" },
      create: { customerId: customer.id, company: customer.company, city: customer.city, notes: "DEMO DATA profile" },
    });
  }

  const subscriptionRows = [
    ...data.subscriptions,
    ...data.priorSubscriptions.map(({ historyId: _historyId, ...row }) => row),
  ];
  for (const row of subscriptionRows) {
    const { priceCents, priceAmount, ...subscription } = row;
    await prisma.subscription.upsert({
      where: { id: subscription.id },
      update: {
        customerId: subscription.customerId,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        expiryDate: subscription.expiryDate,
        renewalDate: subscription.renewalDate,
        exportAllowance: subscription.exportAllowance,
        exportsUsed: subscription.exportsUsed,
        creditsRemaining: subscription.creditsRemaining,
        snapshotFeaturesJson: subscription.snapshotFeaturesJson,
        tenant: subscription.tenant,
      },
      create: subscription,
    });
    await prisma.subscriptionHistory.upsert({
      where: { id: `demo_hist_${row.id}` },
      update: {
        status: row.status,
        snapshotFeaturesJson: row.snapshotFeaturesJson,
        priceAmount: row.priceAmount,
        priceCents: row.priceCents,
      },
      create: {
        id: `demo_hist_${row.id}`,
        subscriptionId: row.id,
        planId: row.planId,
        tenant: row.tenant,
        status: row.status,
        snapshotFeaturesJson: row.snapshotFeaturesJson,
        priceAmount,
        priceCents,
        reason: "DEMO DATA subscription snapshot",
        recordedAt: row.startDate,
      },
    });
  }

  for (const machine of data.machines) {
    await prisma.machine.upsert({
      where: { id: machine.id },
      update: {
        machineId: machine.machineId,
        customerId: machine.customerId,
        status: machine.status,
        firmwareVersion: machine.firmwareVersion,
        serialNumber: machine.serialNumber,
        healthStatus: machine.healthStatus,
        tenant: machine.tenant,
        demoLabel: machine.demoLabel,
        telemetryVerified: false,
        telemetrySimulated: true,
        lastSeenAt: machine.lastSeenAt,
        deletedAt: null,
      },
      create: machine,
    });
    await prisma.machineFirmwareHistory.upsert({
      where: { id: `demo_fw_${machine.id}` },
      update: { version: machine.firmwareVersion },
      create: {
        id: `demo_fw_${machine.id}`,
        machineId: machine.id,
        version: machine.firmwareVersion,
        source: "DEMO_SEED",
        recordedAt: machine.createdAt,
      },
    });
    await prisma.machineConfigRevision.upsert({
      where: { id: `demo_cfg_${machine.id}` },
      update: {},
      create: {
        id: `demo_cfg_${machine.id}`,
        machineId: machine.id,
        motorConfig: "{}",
        lightingConfig: "{}",
        recordedAt: machine.createdAt,
      },
    });
  }

  for (const assignment of data.assignments) {
    await prisma.machineAssignment.upsert({
      where: { id: assignment.id },
      update: { status: assignment.status, customerId: assignment.customerId, tenant: assignment.tenant },
      create: assignment,
    });
  }

  for (const session of data.sessions) {
    await prisma.recordingSession.upsert({
      where: { id: session.id },
      update: { status: session.status, storageMb: session.storageMb },
      create: session,
    });
  }

  for (const entry of data.usage) {
    const session = data.sessions.find((row) => row.customerId === entry.customerId);
    await prisma.processingJob.upsert({
      where: { id: entry.jobRowId },
      update: { status: entry.status, failureReason: entry.failureReason },
      create: {
        id: entry.jobRowId,
        tenant: entry.tenant,
        customerId: entry.customerId,
        machineId: entry.machineId,
        recordingSessionId: session?.id,
        jobKey: entry.jobKey,
        status: entry.status,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        failureReason: entry.failureReason,
      },
    });
    await prisma.usageEntry.upsert({
      where: { id: entry.id },
      update: {
        status: entry.status,
        creditsConsumed: entry.creditsConsumed,
        charged: entry.charged,
        failureReason: entry.failureReason,
        processingJobId: entry.jobRowId,
      },
      create: {
        id: entry.id,
        tenant: entry.tenant,
        customerId: entry.customerId,
        machineId: entry.machineId,
        processingJobId: entry.jobRowId,
        jobId: entry.jobId,
        idempotencyKey: entry.idempotencyKey,
        sourceRecording: entry.sessionKey,
        status: entry.status,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        durationMs: entry.durationMs,
        creditsConsumed: entry.creditsConsumed,
        storageMb: entry.storageMb,
        exportDate: entry.charged ? entry.completedAt : null,
        outputRef: entry.outputRef,
        failureReason: entry.failureReason,
        charged: entry.charged,
      },
    });
    await prisma.exportRecord.upsert({
      where: { id: entry.exportId },
      update: { status: entry.status, creditsConsumed: entry.creditsConsumed },
      create: {
        id: entry.exportId,
        tenant: entry.tenant,
        customerId: entry.customerId,
        processingJobId: entry.jobRowId,
        usageEntryId: entry.id,
        idempotencyKey: entry.idempotencyKey,
        status: entry.status,
        creditsConsumed: entry.creditsConsumed,
        outputRef: entry.outputRef,
        simulated: true,
        createdAt: entry.completedAt,
      },
    });
  }

  for (const payment of data.payments) {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        amountCents: payment.amountCents,
        amount: payment.amount,
        status: payment.status,
        simulated: true,
        demoLabel: "DEMO DATA",
        paidAt: payment.paidAt,
      },
      create: payment,
    });
  }

  for (const refund of data.refunds) {
    await prisma.refund.upsert({
      where: { id: refund.id },
      update: { amountCents: refund.amountCents, amount: refund.amount, status: refund.status, simulated: true },
      create: refund,
    });
  }

  for (const login of data.logins) {
    await prisma.loginEvent.upsert({
      where: { id: login.id },
      update: { success: login.success, createdAt: login.createdAt },
      create: login,
    });
  }

  for (const audit of data.audits) {
    await prisma.activityLog.upsert({
      where: { id: audit.id },
      update: { reason: audit.reason, tenant: audit.tenant },
      create: audit,
    });
  }

  for (const notice of data.notifications) {
    await prisma.notificationMessage.upsert({
      where: { id: notice.id },
      update: { status: "SIMULATED", simulated: true, subject: notice.subject, body: notice.body },
      create: notice,
    });
    await prisma.notificationDelivery.upsert({
      where: { notificationId_attempt: { notificationId: notice.id, attempt: 1 } },
      update: { status: "SIMULATED" },
      create: { notificationId: notice.id, attempt: 1, status: "SIMULATED", attemptedAt: notice.createdAt },
    });
  }

  for (const ticket of data.tickets) {
    await prisma.supportTicket.upsert({
      where: { id: ticket.id },
      update: { status: ticket.status, priority: ticket.priority, deletedAt: null },
      create: {
        id: ticket.id,
        tenant: ticket.tenant,
        customerId: ticket.customerId,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
      },
    });
    await prisma.supportTicketMessage.upsert({
      where: { id: `${ticket.id}_msg` },
      update: { body: ticket.body },
      create: { id: `${ticket.id}_msg`, ticketId: ticket.id, authorType: "SYSTEM", body: ticket.body, createdAt: ticket.createdAt },
    });
  }

  for (const error of data.errors) {
    await prisma.machineError.upsert({
      where: { id: error.id },
      update: { code: error.code, message: error.message },
      create: error,
    });
  }

  for (const integration of data.integrations) {
    await prisma.integrationConfig.upsert({
      where: { tenant_provider: { tenant: "demo", provider: integration.provider } },
      update: { status: "DISABLED", simulated: true, configJson: JSON.stringify({ mode: "simulated", secrets: "not-stored" }) },
      create: {
        id: integration.id,
        tenant: "demo",
        provider: integration.provider,
        status: "DISABLED",
        simulated: true,
        configJson: JSON.stringify({ mode: "simulated", secrets: "not-stored" }),
      },
    });
  }

  await prisma.securityEvent.upsert({
    where: { id: "demo_security_seed" },
    update: { detail: "Demo seed refreshed" },
    create: {
      id: "demo_security_seed",
      tenant: "demo",
      actorType: "SYSTEM",
      email: "demo-seed@example.com",
      kind: "DEMO_SEED",
      detail: "Synthetic security history. No production credential was used.",
    },
  });

  const counts = demoDatasetCounts(now);
  const storedCustomers = await prisma.customer.count({ where: { tenant: "demo", deletedAt: null } });
  console.log(`[demo] Demo data ready for ${admin.email}.`);
  console.log(
    `[demo] Customers ${storedCustomers}/${counts.customers}, machines ${counts.machines}, plans ${counts.plans}, usage rows ${counts.usage}.`,
  );
  console.log("[demo] Passwords were not printed. Demo payments are simulated and excluded from production revenue.");
}

main()
  .catch((error: unknown) => {
    console.error("[demo] Seed failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
