import type { PrismaClient } from "@prisma/client";

export function disposableDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) return null;
  if (/supabase\.(com|co)/i.test(url)) {
    throw new Error("Refusing to run tests against Supabase. Point TEST_DATABASE_URL at a local disposable database.");
  }
  return url;
}

export async function resetBusinessData(db: PrismaClient) {
  await db.notificationDelivery.deleteMany();
  await db.supportTicketMessage.deleteMany();
  await db.supportTicket.deleteMany();
  await db.refund.deleteMany();
  await db.exportRecord.deleteMany();
  await db.usageEntry.deleteMany();
  await db.processingJob.deleteMany();
  await db.recordingSession.deleteMany();
  await db.notificationMessage.deleteMany();
  await db.payment.deleteMany();
  await db.loginEvent.deleteMany();
  await db.securityEvent.deleteMany();
  await db.machineAssignment.deleteMany();
  await db.machineFirmwareHistory.deleteMany();
  await db.machineConfigRevision.deleteMany();
  await db.maintenanceRecord.deleteMany();
  await db.machineError.deleteMany();
  await db.machine.deleteMany();
  await db.subscriptionHistory.deleteMany();
  await db.subscription.deleteMany();
  await db.customerProfile.deleteMany();
  await db.customer.deleteMany();
  await db.plan.deleteMany();
  await db.activityLog.deleteMany();
  await db.integrationConfig.deleteMany();
}
