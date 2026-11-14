export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "MACHINE_OPS",
  "AUDITOR",
  "DEMO_ADMIN",
] as const;
export const ADMIN_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export const CUSTOMER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export const PLAN_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const SUBSCRIPTION_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"] as const;
export const MACHINE_ACCOUNT_STATUSES = ["UNASSIGNED", "ASSIGNED", "SUSPENDED"] as const;
export const ASSIGNMENT_STATUSES = ["ACTIVE", "UNASSIGNED"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AdminStatus = (typeof ADMIN_STATUSES)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type MachineAccountStatus = (typeof MACHINE_ACCOUNT_STATUSES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const AUDIT_EVENTS = [
  "CUSTOMER_CREATED",
  "CUSTOMER_UPDATED",
  "CUSTOMER_SUSPENDED",
  "CUSTOMER_ACTIVATED",
  "MACHINE_CREATED",
  "MACHINE_ASSIGNED",
  "MACHINE_UNASSIGNED",
  "MACHINE_SUSPENDED",
  "MACHINE_ACTIVATED",
  "PLAN_CREATED",
  "PLAN_UPDATED",
  "PLAN_CHANGED",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_CHANGED",
  "SUBSCRIPTION_EXTENDED",
  "CREDITS_GRANTED",
  "USAGE_RECORDED",
  "NOTIFICATION_QUEUED",
  "PAYMENT_RECORDED",
  "MAINTENANCE_RECORDED",
  "ADMIN_UPDATED",
  "ADMIN_LOGIN",
  "ADMIN_LOGIN_FAILED",
  "CUSTOMER_LOGIN",
  "CUSTOMER_LOGIN_FAILED",
  "MACHINE_HEARTBEAT",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const CONNECTIVITY_UNAVAILABLE = "Connectivity telemetry not available";
