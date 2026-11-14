import type { PrismaClient } from "@prisma/client";
import type { AuditEvent } from "@/lib/constants";

export type AuditActor = {
  type: "ADMIN" | "CUSTOMER" | "SYSTEM";
  id?: string | null;
  email?: string | null;
  role?: string | null;
  tenant?: string | null;
};

type ActivityDb = Pick<PrismaClient, "activityLog">;

export async function recordActivity(
  db: ActivityDb,
  input: {
    event: AuditEvent;
    actor: AuditActor;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string | null;
    result?: "SUCCESS" | "FAILURE";
    customerId?: string | null;
    machineRef?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  await db.activityLog.create({
    data: {
      event: input.event,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      actorEmail: input.actor.email ?? null,
      adminRole: input.actor.role ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      customerId: input.customerId ?? null,
      machineRef: input.machineRef ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
      previousValue: input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
      newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
      reason: input.reason ?? null,
      result: input.result ?? "SUCCESS",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      tenant: input.actor.tenant ?? "production",
    },
  });
}
