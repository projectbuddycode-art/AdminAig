import type { PrismaClient } from "@prisma/client";

const TABLES = new Set([
  "Customer",
  "Subscription",
  "UsageEntry",
  "Payment",
  "LoginEvent",
  "ActivityLog",
  "MachineError",
  "MaintenanceRecord",
]);

type DatedTable = "Customer" | "Subscription" | "UsageEntry" | "Payment" | "LoginEvent" | "ActivityLog" | "MachineError" | "MaintenanceRecord";

function assertTable(table: string) {
  if (!TABLES.has(table)) throw new Error("Unsupported report table");
}

export async function idsBetween(db: PrismaClient, table: DatedTable, from: Date, to: Date, tenant?: string) {
  assertTable(table);
  const rows = tenant
    ? await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "${table}" WHERE tenant = ? AND createdAt >= ? AND createdAt <= ?`,
        tenant,
        from.getTime(),
        to.getTime(),
      )
    : await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "${table}" WHERE createdAt >= ? AND createdAt <= ?`,
        from.getTime(),
        to.getTime(),
      );
  return rows.map((row) => row.id);
}

export async function idsOnOrBefore(db: PrismaClient, table: DatedTable, to: Date, tenant?: string) {
  assertTable(table);
  const rows = tenant
    ? await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM "${table}" WHERE tenant = ? AND createdAt <= ?`,
        tenant,
        to.getTime(),
      )
    : await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "${table}" WHERE createdAt <= ?`, to.getTime());
  return rows.map((row) => row.id);
}

export function idIn(ids: string[]): { in: string[] } {
  return { in: ids.length > 0 ? ids : ["__none__"] };
}
