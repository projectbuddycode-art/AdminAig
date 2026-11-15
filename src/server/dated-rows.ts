import type { PrismaClient } from "@prisma/client";

const TABLES = [
  "Customer",
  "Subscription",
  "UsageEntry",
  "Payment",
  "LoginEvent",
  "ActivityLog",
  "MachineError",
  "MaintenanceRecord",
] as const;

type DatedTable = (typeof TABLES)[number];

function assertTable(table: string): asserts table is DatedTable {
  if (!TABLES.includes(table as DatedTable)) throw new Error("Unsupported report table");
}

export async function idsBetween(db: PrismaClient, table: DatedTable, from: Date, to: Date, tenant?: string) {
  assertTable(table);
  const createdAt = { gte: from, lte: to };
  const rows = await findIds(db, table, { ...scope(table, tenant), createdAt });
  return rows.map((row) => row.id);
}

export async function idsOnOrBefore(db: PrismaClient, table: DatedTable, to: Date, tenant?: string) {
  assertTable(table);
  const rows = await findIds(db, table, { ...scope(table, tenant), createdAt: { lte: to } });
  return rows.map((row) => row.id);
}

function scope(table: DatedTable, tenant?: string) {
  const tenantFilter = tenant ? { tenant } : {};
  if (table === "Customer") return { ...tenantFilter, deletedAt: null };
  return tenantFilter;
}

function findIds(
  db: PrismaClient,
  table: DatedTable,
  where: { tenant?: string; deletedAt?: null; createdAt: { gte?: Date; lte: Date } },
) {
  switch (table) {
    case "Customer":
      return db.customer.findMany({ where, select: { id: true } });
    case "Subscription":
      return db.subscription.findMany({ where, select: { id: true } });
    case "UsageEntry":
      return db.usageEntry.findMany({ where, select: { id: true } });
    case "Payment":
      return db.payment.findMany({ where, select: { id: true } });
    case "LoginEvent":
      return db.loginEvent.findMany({ where, select: { id: true } });
    case "ActivityLog":
      return db.activityLog.findMany({ where, select: { id: true } });
    case "MachineError":
      return db.machineError.findMany({ where, select: { id: true } });
    case "MaintenanceRecord":
      return db.maintenanceRecord.findMany({ where, select: { id: true } });
  }
}

export function idIn(ids: string[]): { in: string[] } {
  return { in: ids.length > 0 ? ids : ["__none__"] };
}
