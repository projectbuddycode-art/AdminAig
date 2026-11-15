import { AppError } from "@/lib/errors";
import type { AuditActor } from "@/lib/audit";

export const ADMIN_ROLE_LIST = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "MACHINE_OPS",
  "AUDITOR",
  "DEMO_ADMIN",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLE_LIST)[number];

export const PERMISSIONS = [
  "customers.view",
  "customers.edit",
  "machines.view",
  "machines.assign",
  "machines.manage",
  "subscriptions.view",
  "subscriptions.change",
  "credits.adjust",
  "payments.view",
  "payments.reconcile",
  "notifications.send",
  "audit.view",
  "reports.export",
  "plans.manage",
  "admins.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

const VIEW: Permission[] = [
  "customers.view",
  "machines.view",
  "subscriptions.view",
  "payments.view",
  "audit.view",
  "reports.export",
];

const ROLE_PERMISSIONS: Record<AdminRoleName, Set<Permission>> = {
  SUPER_ADMIN: ALL,
  ADMIN: new Set([...ALL].filter((p) => p !== "admins.manage")),
  SUPPORT: new Set([
    "customers.view",
    "customers.edit",
    "machines.view",
    "subscriptions.view",
    "notifications.send",
    "audit.view",
  ]),
  FINANCE: new Set([
    "customers.view",
    "subscriptions.view",
    "subscriptions.change",
    "credits.adjust",
    "payments.view",
    "payments.reconcile",
    "audit.view",
    "reports.export",
  ]),
  MACHINE_OPS: new Set([
    "customers.view",
    "machines.view",
    "machines.assign",
    "machines.manage",
    "audit.view",
  ]),
  AUDITOR: new Set(VIEW),
  DEMO_ADMIN: new Set([
    ...VIEW,
    "customers.edit",
    "machines.assign",
    "subscriptions.change",
    "credits.adjust",
    "notifications.send",
  ]),
};

export function normalizeRole(role: string | null | undefined): AdminRoleName {
  if (role && role in ROLE_PERMISSIONS) return role as AdminRoleName;
  return "ADMIN";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].has(permission);
}

export function assertPermission(actor: AuditActor, permission: Permission) {
  if (!actor.role) return;
  if (!can(actor.role, permission)) {
    throw new AppError("You do not have permission for this action.", "FORBIDDEN", 403);
  }
}

export function actorTenant(actor: AuditActor): string {
  return actor.tenant ?? "production";
}

export function assertSameTenant(actor: AuditActor, recordTenant: string | null | undefined) {
  if (!actor.tenant && !actor.role) return;
  const tenant = recordTenant ?? "production";
  if (actorTenant(actor) !== tenant) {
    throw new AppError("This record is outside your tenant.", "TENANT_FORBIDDEN", 403);
  }
}

export function isDemoRole(role: string | null | undefined) {
  return role === "DEMO_ADMIN";
}

export function rolePermissionCatalog(): { role: AdminRoleName; permissions: Permission[] }[] {
  return ADMIN_ROLE_LIST.map((role) => ({
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }));
}
