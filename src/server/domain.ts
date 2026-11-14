import type { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { hash, compare } from "bcryptjs";
import { AppError } from "@/lib/errors";
import { recordActivity, type AuditActor } from "@/lib/audit";
import { generateMachineId, isValidMachineIdFormat, normalizeMachineId } from "@/lib/machine-id";
import { isSubscriptionEntitled, effectiveSubscriptionStatus } from "@/lib/entitlement";
import { parsePlanFeatures, serializePlanFeatures, type PlanFeatures } from "@/lib/plan-features";
import { actorTenant, assertPermission, assertSameTenant } from "@/lib/rbac";

export type Domain = {
  db: PrismaClient;
  actor: AuditActor;
  now?: Date;
};

function nowOf(domain: Domain) {
  return domain.now ?? new Date();
}

function allowanceFromFeatures(features: PlanFeatures) {
  if (features.unlimitedExports) return 100000;
  return features.monthlyExportLimit ?? 0;
}

function subscriptionSnapshot(plan: { featuresJson: string; durationDays: number }, now: Date) {
  const features = parsePlanFeatures(plan.featuresJson);
  const allowance = allowanceFromFeatures(features);
  return {
    exportAllowance: allowance,
    exportsUsed: 0,
    creditsRemaining: allowance,
    snapshotFeaturesJson: serializePlanFeatures(features),
    renewalDate: addDays(now, plan.durationDays),
  };
}

async function uniqueMachineId(db: PrismaClient, requested?: string): Promise<string> {
  if (requested) {
    const id = normalizeMachineId(requested);
    if (!isValidMachineIdFormat(id)) {
      throw new AppError("Machine ID must match AIG-XXXX-XXXX and cannot be an IP address.", "INVALID_MACHINE_ID");
    }
    const exists = await db.machine.findUnique({ where: { machineId: id } });
    if (exists) throw new AppError("Machine ID already exists.", "MACHINE_ID_TAKEN");
    return id;
  }

  for (let i = 0; i < 12; i += 1) {
    const id = generateMachineId();
    const exists = await db.machine.findUnique({ where: { machineId: id } });
    if (!exists) return id;
  }
  throw new AppError("Unable to allocate a unique Machine ID.", "MACHINE_ID_ALLOCATION");
}

export async function expireStaleSubscriptions(db: PrismaClient, now = new Date()) {
  await db.subscription.updateMany({
    where: {
      status: "ACTIVE",
      expiryDate: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
}

export async function getCurrentSubscription(db: PrismaClient, customerId: string) {
  const subscription = await db.subscription.findFirst({
    where: { customerId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return null;
  if (subscription.exportAllowance > 0 || subscription.exportsUsed > 0 || subscription.snapshotFeaturesJson !== "{}") {
    return subscription;
  }
  const features = parsePlanFeatures(subscription.plan.featuresJson);
  const allowance = allowanceFromFeatures(features);
  if (allowance === 0) return subscription;
  return db.subscription.update({
    where: { id: subscription.id },
    data: {
      exportAllowance: allowance,
      creditsRemaining: allowance,
      snapshotFeaturesJson: serializePlanFeatures(features),
      renewalDate: subscription.renewalDate ?? subscription.expiryDate,
    },
    include: { plan: true },
  });
}

export async function createPlan(
  domain: Domain,
  input: { name: string; description: string; durationDays: number; features: PlanFeatures; priceCents?: number },
) {
  assertPermission(domain.actor, "plans.manage");
  const plan = await domain.db.plan.create({
    data: {
      name: input.name,
      description: input.description,
      durationDays: input.durationDays,
      featuresJson: serializePlanFeatures(input.features),
      priceCents: input.priceCents ?? 0,
      status: "ACTIVE",
      tenant: actorTenant(domain.actor),
    },
  });
  await recordActivity(domain.db, {
    event: "PLAN_CREATED",
    actor: domain.actor,
    targetType: "PLAN",
    targetId: plan.id,
    metadata: { name: plan.name, durationDays: plan.durationDays },
  });
  return plan;
}

export async function updatePlan(
  domain: Domain,
  planId: string,
  input: { name: string; description: string; durationDays: number; features: PlanFeatures },
) {
  assertPermission(domain.actor, "plans.manage");
  const existing = await domain.db.plan.findUnique({ where: { id: planId } });
  if (!existing) throw new AppError("Plan not found.", "PLAN_NOT_FOUND", 404);
  assertSameTenant(domain.actor, existing.tenant);
  const plan = await domain.db.plan.update({
    where: { id: planId },
    data: {
      name: input.name,
      description: input.description,
      durationDays: input.durationDays,
      featuresJson: serializePlanFeatures(input.features),
    },
  });
  await recordActivity(domain.db, {
    event: "PLAN_UPDATED",
    actor: domain.actor,
    targetType: "PLAN",
    targetId: plan.id,
    metadata: { name: plan.name },
  });
  return plan;
}

export async function setPlanStatus(domain: Domain, planId: string, status: "ACTIVE" | "INACTIVE") {
  assertPermission(domain.actor, "plans.manage");
  const plan = await domain.db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError("Plan not found.", "PLAN_NOT_FOUND", 404);
  assertSameTenant(domain.actor, plan.tenant);
  return domain.db.plan.update({ where: { id: planId }, data: { status } });
}

export async function createCustomer(
  domain: Domain,
  input: {
    name: string;
    email: string;
    phone: string;
    planId: string;
    password?: string;
    machineDbId?: string;
  },
) {
  assertPermission(domain.actor, "customers.edit");
  const email = input.email.toLowerCase();
  const existing = await domain.db.customer.findUnique({ where: { email } });
  if (existing) throw new AppError("A customer with this email already exists.", "EMAIL_TAKEN");

  const plan = await domain.db.plan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AppError("Selected plan does not exist.", "PLAN_NOT_FOUND", 404);
  if (plan.status !== "ACTIVE") throw new AppError("Selected plan is not active.", "PLAN_INACTIVE");

  const password = input.password ?? generateTemporaryPassword();
  const passwordHash = await hash(password, 10);
  const now = nowOf(domain);
  const tenant = actorTenant(domain.actor);
  if (plan.tenant !== tenant && domain.actor.tenant) {
    throw new AppError("Selected plan is outside your tenant.", "TENANT_FORBIDDEN", 403);
  }
  const snap = subscriptionSnapshot(plan, now);

  const customer = await domain.db.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name: input.name,
        email,
        phone: input.phone,
        passwordHash,
        status: "ACTIVE",
        tenant,
        source: "ADMIN",
        loginMethod: "PASSWORD",
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        customerId: created.id,
        planId: plan.id,
        status: "ACTIVE",
        startDate: now,
        expiryDate: addDays(now, plan.durationDays),
        tenant,
        ...snap,
      },
    });

    await recordActivity(tx, {
      event: "CUSTOMER_CREATED",
      actor: domain.actor,
      targetType: "CUSTOMER",
      targetId: created.id,
      metadata: { email, name: input.name },
    });
    await recordActivity(tx, {
      event: "SUBSCRIPTION_CREATED",
      actor: domain.actor,
      targetType: "SUBSCRIPTION",
      targetId: subscription.id,
      metadata: { customerId: created.id, planId: plan.id },
    });

    return created;
  });

  if (input.machineDbId) {
    await assignMachine({ ...domain, db: domain.db }, input.machineDbId, customer.id);
  }

  return { customer, temporaryPassword: input.password ? null : password };
}

export async function updateCustomer(
  domain: Domain,
  customerId: string,
  input: { name: string; email: string; phone: string },
) {
  assertPermission(domain.actor, "customers.edit");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const email = input.email.toLowerCase();
  if (email !== customer.email) {
    const clash = await domain.db.customer.findUnique({ where: { email } });
    if (clash) throw new AppError("A customer with this email already exists.", "EMAIL_TAKEN");
  }
  const updated = await domain.db.customer.update({
    where: { id: customerId },
    data: { name: input.name, email, phone: input.phone },
  });
  await recordActivity(domain.db, {
    event: "CUSTOMER_UPDATED",
    actor: domain.actor,
    targetType: "CUSTOMER",
    targetId: customerId,
    metadata: { email },
    previousValue: { name: customer.name, email: customer.email, phone: customer.phone },
    newValue: input,
  });
  return updated;
}

export async function suspendCustomer(domain: Domain, customerId: string, reason = "Administrative suspension") {
  assertPermission(domain.actor, "customers.edit");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  if (customer.status === "SUSPENDED") return customer;

  const updated = await domain.db.$transaction(async (tx) => {
    const next = await tx.customer.update({ where: { id: customerId }, data: { status: "SUSPENDED" } });
    await tx.subscription.updateMany({
      where: { customerId, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    await recordActivity(tx, {
      event: "CUSTOMER_SUSPENDED",
      actor: domain.actor,
      targetType: "CUSTOMER",
      targetId: customerId,
      customerId,
      reason,
      previousValue: { status: customer.status },
      newValue: { status: "SUSPENDED" },
    });
    return next;
  });
  return updated;
}

export async function activateCustomer(domain: Domain, customerId: string, reason = "Administrative reactivation") {
  assertPermission(domain.actor, "customers.edit");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const now = nowOf(domain);

  const updated = await domain.db.$transaction(async (tx) => {
    const next = await tx.customer.update({ where: { id: customerId }, data: { status: "ACTIVE" } });
    const latest = await tx.subscription.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    if (latest && latest.status === "SUSPENDED") {
      const nextStatus = latest.expiryDate.getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
      await tx.subscription.update({ where: { id: latest.id }, data: { status: nextStatus } });
      await recordActivity(tx, {
        event: "SUBSCRIPTION_CHANGED",
        actor: domain.actor,
        targetType: "SUBSCRIPTION",
        targetId: latest.id,
        metadata: { status: nextStatus, reason: "customer_reactivated" },
      });
    }
    await recordActivity(tx, {
      event: "CUSTOMER_ACTIVATED",
      actor: domain.actor,
      targetType: "CUSTOMER",
      targetId: customerId,
      customerId,
      reason,
      previousValue: { status: customer.status },
      newValue: { status: "ACTIVE" },
    });
    return next;
  });
  return updated;
}

export async function changeCustomerPlan(domain: Domain, customerId: string, planId: string, reason = "Plan change") {
  assertPermission(domain.actor, "subscriptions.change");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const plan = await domain.db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError("Plan not found.", "PLAN_NOT_FOUND", 404);
  if (plan.status !== "ACTIVE") throw new AppError("Selected plan is not active.", "PLAN_INACTIVE");
  assertSameTenant(domain.actor, plan.tenant);
  if (customer.status !== "ACTIVE") {
    throw new AppError("A suspended customer cannot receive an active plan change.", "CUSTOMER_SUSPENDED");
  }

  const now = nowOf(domain);
  const snap = subscriptionSnapshot(plan, now);
  const previous = await getCurrentSubscription(domain.db, customerId);
  const created = await domain.db.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { customerId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      data: { status: "CANCELLED" },
    });
    const subscription = await tx.subscription.create({
      data: {
        customerId,
        planId: plan.id,
        status: "ACTIVE",
        startDate: now,
        expiryDate: addDays(now, plan.durationDays),
        tenant: customer.tenant,
        ...snap,
      },
    });
    await recordActivity(tx, {
      event: "PLAN_CHANGED",
      actor: domain.actor,
      targetType: "CUSTOMER",
      targetId: customerId,
      customerId,
      reason,
      previousValue: previous ? { planId: previous.planId, status: previous.status, expiryDate: previous.expiryDate } : null,
      newValue: { planId: plan.id, subscriptionId: subscription.id, expiryDate: subscription.expiryDate },
      metadata: { planId: plan.id, subscriptionId: subscription.id },
    });
    await recordActivity(tx, {
      event: "SUBSCRIPTION_CHANGED",
      actor: domain.actor,
      targetType: "SUBSCRIPTION",
      targetId: subscription.id,
      metadata: { planId: plan.id, status: "ACTIVE" },
    });
    return subscription;
  });
  return created;
}

export async function createMachine(
  domain: Domain,
  input: { machineId?: string; firmwareVersion?: string; model?: string; serialNumber?: string },
) {
  assertPermission(domain.actor, "machines.manage");
  const machineId = await uniqueMachineId(domain.db, input.machineId);
  const machine = await domain.db.machine.create({
    data: {
      machineId,
      status: "UNASSIGNED",
      firmwareVersion: input.firmwareVersion || null,
      model: input.model || "DiamondCam",
      serialNumber: input.serialNumber || null,
      tenant: actorTenant(domain.actor),
    },
  });
  await recordActivity(domain.db, {
    event: "MACHINE_CREATED",
    actor: domain.actor,
    targetType: "MACHINE",
    targetId: machine.id,
    metadata: { machineId },
  });
  return machine;
}

export async function assignMachine(domain: Domain, machineDbId: string, customerId: string, reason = "Machine assignment") {
  assertPermission(domain.actor, "machines.assign");
  const machine = await domain.db.machine.findUnique({
    where: { id: machineDbId },
    include: { assignments: { where: { status: "ACTIVE" } } },
  });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  assertSameTenant(domain.actor, machine.tenant);
  if (machine.status === "SUSPENDED") {
    throw new AppError("A suspended machine cannot be assigned.", "MACHINE_SUSPENDED");
  }

  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  if (customer.tenant !== machine.tenant) {
    throw new AppError("Customer and machine belong to different tenants.", "TENANT_FORBIDDEN", 403);
  }
  if (customer.status !== "ACTIVE") {
    throw new AppError("A suspended customer cannot receive an active machine assignment.", "CUSTOMER_SUSPENDED");
  }

  if (machine.assignments.some((row) => row.status === "ACTIVE" && row.customerId !== customerId)) {
    throw new AppError("This machine is already assigned to another customer.", "MACHINE_ALREADY_ASSIGNED");
  }
  if (machine.customerId && machine.customerId !== customerId && machine.status === "ASSIGNED") {
    throw new AppError("This machine is already assigned to another customer.", "MACHINE_ALREADY_ASSIGNED");
  }
  if (machine.customerId === customerId && machine.status === "ASSIGNED") {
    return machine;
  }

  const updated = await domain.db.$transaction(async (tx) => {
    if (machine.customerId && machine.customerId !== customerId) {
      await tx.machineAssignment.updateMany({
        where: { machineId: machine.id, status: "ACTIVE" },
        data: { status: "UNASSIGNED", unassignedAt: nowOf(domain) },
      });
    }
    await tx.machineAssignment.create({
      data: {
        machineId: machine.id,
        customerId,
        status: "ACTIVE",
        assignedAt: nowOf(domain),
      },
    });
    const next = await tx.machine.update({
      where: { id: machine.id },
      data: { customerId, status: "ASSIGNED" },
    });
    await recordActivity(tx, {
      event: "MACHINE_ASSIGNED",
      actor: domain.actor,
      targetType: "MACHINE",
      targetId: machine.id,
      metadata: { machineId: machine.machineId, customerId },
      customerId,
      machineRef: machine.machineId,
      reason,
      previousValue: { customerId: machine.customerId, status: machine.status },
      newValue: { customerId, status: "ASSIGNED" },
    });
    return next;
  });
  return updated;
}

export async function unassignMachine(domain: Domain, machineDbId: string, reason = "Machine unassignment") {
  assertPermission(domain.actor, "machines.assign");
  const machine = await domain.db.machine.findUnique({ where: { id: machineDbId } });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  assertSameTenant(domain.actor, machine.tenant);

  const updated = await domain.db.$transaction(async (tx) => {
    await tx.machineAssignment.updateMany({
      where: { machineId: machine.id, status: "ACTIVE" },
      data: { status: "UNASSIGNED", unassignedAt: nowOf(domain) },
    });
    const next = await tx.machine.update({
      where: { id: machine.id },
      data: { customerId: null, status: machine.status === "SUSPENDED" ? "SUSPENDED" : "UNASSIGNED" },
    });
    await recordActivity(tx, {
      event: "MACHINE_UNASSIGNED",
      actor: domain.actor,
      targetType: "MACHINE",
      targetId: machine.id,
      metadata: { machineId: machine.machineId, previousCustomerId: machine.customerId },
      customerId: machine.customerId,
      machineRef: machine.machineId,
      reason,
      previousValue: { customerId: machine.customerId, status: machine.status },
      newValue: { customerId: null, status: machine.status === "SUSPENDED" ? "SUSPENDED" : "UNASSIGNED" },
    });
    return next;
  });
  return updated;
}

export async function reassignMachine(domain: Domain, machineDbId: string, customerId: string) {
  await unassignMachine(domain, machineDbId);
  return assignMachine(domain, machineDbId, customerId);
}

export async function suspendMachine(domain: Domain, machineDbId: string, reason = "Machine suspension") {
  assertPermission(domain.actor, "machines.manage");
  const machine = await domain.db.machine.findUnique({ where: { id: machineDbId } });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  assertSameTenant(domain.actor, machine.tenant);
  const updated = await domain.db.machine.update({
    where: { id: machineDbId },
    data: { status: "SUSPENDED" },
  });
  await recordActivity(domain.db, {
    event: "MACHINE_SUSPENDED",
    actor: domain.actor,
    targetType: "MACHINE",
    targetId: machine.id,
    metadata: { machineId: machine.machineId },
    machineRef: machine.machineId,
    reason,
    previousValue: { status: machine.status },
    newValue: { status: "SUSPENDED" },
  });
  return updated;
}

export async function activateMachine(domain: Domain, machineDbId: string) {
  assertPermission(domain.actor, "machines.manage");
  const machine = await domain.db.machine.findUnique({ where: { id: machineDbId } });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  assertSameTenant(domain.actor, machine.tenant);
  const nextStatus = machine.customerId ? "ASSIGNED" : "UNASSIGNED";
  const updated = await domain.db.machine.update({
    where: { id: machineDbId },
    data: { status: nextStatus },
  });
  await recordActivity(domain.db, {
    event: "MACHINE_ACTIVATED",
    actor: domain.actor,
    targetType: "MACHINE",
    targetId: machine.id,
    metadata: { machineId: machine.machineId, status: nextStatus },
  });
  return updated;
}

export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "Aig-";
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function authenticateCustomer(db: PrismaClient, email: string, password: string) {
  await expireStaleSubscriptions(db);
  const normalized = email.toLowerCase();
  const customer = await db.customer.findUnique({ where: { email: normalized } });
  if (!customer) {
    await db.loginEvent.create({
      data: { actorType: "CUSTOMER", email: normalized, success: false, method: "PASSWORD" },
    });
    throw new AppError("Invalid credentials.", "INVALID_CREDENTIALS", 401);
  }
  const ok = await compare(password, customer.passwordHash);
  if (!ok) {
    await db.loginEvent.create({
      data: {
        tenant: customer.tenant,
        actorType: "CUSTOMER",
        actorId: customer.id,
        customerId: customer.id,
        email: normalized,
        success: false,
        method: "PASSWORD",
      },
    });
    await recordActivity(db, {
      event: "CUSTOMER_LOGIN_FAILED",
      actor: { type: "CUSTOMER", id: customer.id, email: customer.email, tenant: customer.tenant },
      targetType: "CUSTOMER",
      targetId: customer.id,
      customerId: customer.id,
      result: "FAILURE",
    });
    throw new AppError("Invalid credentials.", "INVALID_CREDENTIALS", 401);
  }
  if (customer.status !== "ACTIVE") {
    throw new AppError("This customer account is suspended.", "CUSTOMER_SUSPENDED", 403);
  }
  await db.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
  await db.loginEvent.create({
    data: {
      tenant: customer.tenant,
      actorType: "CUSTOMER",
      actorId: customer.id,
      customerId: customer.id,
      email: customer.email,
      success: true,
      method: customer.loginMethod || "PASSWORD",
    },
  });
  await recordActivity(db, {
    event: "CUSTOMER_LOGIN",
    actor: { type: "CUSTOMER", id: customer.id, email: customer.email, tenant: customer.tenant },
    targetType: "CUSTOMER",
    targetId: customer.id,
    customerId: customer.id,
  });
  return customer;
}

export async function authorizeMachinePairing(
  db: PrismaClient,
  authenticatedCustomerId: string,
  requestedMachineId: string,
) {
  await expireStaleSubscriptions(db);
  const customer = await db.customer.findUnique({ where: { id: authenticatedCustomerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  if (customer.status !== "ACTIVE") {
    throw new AppError("Customer account is not active.", "CUSTOMER_SUSPENDED", 403);
  }

  const subscription = await getCurrentSubscription(db, customer.id);
  if (!subscription || !isSubscriptionEntitled(subscription.status, subscription.expiryDate)) {
    throw new AppError("No active subscription entitlement.", "SUBSCRIPTION_INACTIVE", 403);
  }

  const machineId = normalizeMachineId(requestedMachineId);
  const machine = await db.machine.findUnique({ where: { machineId } });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  if (machine.status === "SUSPENDED") {
    throw new AppError("Machine is suspended.", "MACHINE_SUSPENDED", 403);
  }
  if (machine.customerId !== customer.id || machine.status !== "ASSIGNED") {
    throw new AppError("This machine is not assigned to the authenticated customer.", "MACHINE_NOT_ASSIGNED", 403);
  }

  return {
    customer: { id: customer.id, email: customer.email, name: customer.name, status: customer.status },
    machine: {
      id: machine.id,
      machineId: machine.machineId,
      status: machine.status,
      firmwareVersion: machine.firmwareVersion,
    },
    subscription: {
      id: subscription.id,
      status: effectiveSubscriptionStatus(subscription.status, subscription.expiryDate),
      planId: subscription.planId,
      planName: subscription.plan.name,
      startDate: subscription.startDate,
      expiryDate: subscription.expiryDate,
      features: parsePlanFeatures(subscription.plan.featuresJson),
    },
  };
}

export async function extendMembership(domain: Domain, customerId: string, days: number, reason: string) {
  assertPermission(domain.actor, "subscriptions.change");
  if (!reason || reason.trim().length < 3) throw new AppError("A reason is required.", "REASON_REQUIRED");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const current = await getCurrentSubscription(domain.db, customerId);
  if (!current) throw new AppError("No subscription to extend.", "SUBSCRIPTION_MISSING", 404);
  const expiryDate = addDays(current.expiryDate, days);
  const updated = await domain.db.subscription.update({
    where: { id: current.id },
    data: {
      expiryDate,
      renewalDate: expiryDate,
      status: customer.status === "SUSPENDED" ? current.status : "ACTIVE",
    },
  });
  await recordActivity(domain.db, {
    event: "SUBSCRIPTION_EXTENDED",
    actor: domain.actor,
    targetType: "SUBSCRIPTION",
    targetId: current.id,
    customerId,
    reason,
    previousValue: { expiryDate: current.expiryDate },
    newValue: { expiryDate, days },
  });
  return updated;
}

export async function grantCredits(domain: Domain, customerId: string, credits: number, reason: string) {
  assertPermission(domain.actor, "credits.adjust");
  if (!reason || reason.trim().length < 3) throw new AppError("A reason is required.", "REASON_REQUIRED");
  if (!Number.isInteger(credits) || credits === 0) throw new AppError("Credit adjustment must be a non-zero integer.", "INVALID_CREDITS");
  const customer = await domain.db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const current = await getCurrentSubscription(domain.db, customerId);
  if (!current) throw new AppError("No subscription to adjust.", "SUBSCRIPTION_MISSING", 404);
  const creditsRemaining = Math.max(0, current.creditsRemaining + credits);
  const exportAllowance = Math.max(0, current.exportAllowance + (credits > 0 ? credits : 0));
  await domain.db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { complimentaryCredits: { increment: credits > 0 ? credits : 0 } },
    });
    await tx.subscription.update({
      where: { id: current.id },
      data: { creditsRemaining, exportAllowance },
    });
    await recordActivity(tx, {
      event: "CREDITS_GRANTED",
      actor: domain.actor,
      targetType: "CUSTOMER",
      targetId: customerId,
      customerId,
      reason,
      previousValue: { creditsRemaining: current.creditsRemaining },
      newValue: { creditsRemaining, delta: credits },
    });
  });
}

export async function recordUsage(
  domain: Domain,
  input: {
    customerId: string;
    jobId: string;
    idempotencyKey: string;
    status: "SUCCESS" | "FAILED";
    machineDbId?: string;
    sourceRecording?: string;
    preset?: string;
    durationMs?: number;
    storageMb?: number;
    outputRef?: string;
    failureReason?: string;
  },
) {
  const customer = await domain.db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  const existing = await domain.db.usageEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { entry: existing, duplicate: true };

  const subscription = await getCurrentSubscription(domain.db, customer.id);
  if (input.status === "SUCCESS") {
    if (!subscription || !isSubscriptionEntitled(subscription.status, subscription.expiryDate, nowOf(domain))) {
      throw new AppError("No active subscription entitlement.", "SUBSCRIPTION_INACTIVE", 403);
    }
    if (subscription.creditsRemaining <= 0) {
      throw new AppError("Export allowance is exhausted.", "QUOTA_EXHAUSTED", 403);
    }
  }

  const now = nowOf(domain);
  const entry = await domain.db.$transaction(async (tx) => {
    const charge = input.status === "SUCCESS" ? 1 : 0;
    if (charge && subscription) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          creditsRemaining: { decrement: 1 },
          exportsUsed: { increment: 1 },
        },
      });
    }
    const created = await tx.usageEntry.create({
      data: {
        tenant: customer.tenant,
        customerId: customer.id,
        machineId: input.machineDbId,
        jobId: input.jobId,
        idempotencyKey: input.idempotencyKey,
        sourceRecording: input.sourceRecording,
        preset: input.preset,
        status: input.status,
        startedAt: now,
        completedAt: now,
        durationMs: input.durationMs,
        storageMb: input.storageMb,
        creditsConsumed: charge,
        charged: charge === 1,
        exportDate: charge ? now : null,
        outputRef: input.outputRef,
        failureReason: input.failureReason,
      },
    });
    await recordActivity(tx, {
      event: "USAGE_RECORDED",
      actor: domain.actor,
      targetType: "USAGE",
      targetId: created.id,
      customerId: customer.id,
      machineRef: input.machineDbId,
      metadata: { jobId: input.jobId, status: input.status, creditsConsumed: charge },
    });
    return created;
  });
  return { entry, duplicate: false };
}

export async function queueNotification(
  domain: Domain,
  input: {
    customerId?: string;
    channel: "EMAIL" | "WHATSAPP" | "IN_APP";
    templateKey: string;
    subject: string;
    body: string;
    idempotencyKey?: string;
  },
) {
  assertPermission(domain.actor, "notifications.send");
  if (input.customerId) {
    const customer = await domain.db.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
    assertSameTenant(domain.actor, customer.tenant);
  }
  if (input.idempotencyKey) {
    const existing = await domain.db.notificationMessage.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  const tenant = actorTenant(domain.actor);
  const demo = tenant === "demo";
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);
  const whatsappConfigured = Boolean(process.env.WHATSAPP_TOKEN);
  const channelReady = input.channel === "IN_APP" || (input.channel === "EMAIL" && emailConfigured) || (input.channel === "WHATSAPP" && whatsappConfigured);
  const simulated = demo || !channelReady;
  const status = demo ? "SIMULATED" : channelReady && input.channel === "IN_APP" ? "RECORDED" : "NOT_CONFIGURED";
  const row = await domain.db.notificationMessage.create({
    data: {
      tenant,
      customerId: input.customerId,
      channel: input.channel,
      templateKey: input.templateKey,
      subject: input.subject,
      body: input.body,
      status,
      simulated,
      error: status === "NOT_CONFIGURED" ? "Provider credentials are not configured. Nothing was sent." : null,
      idempotencyKey: input.idempotencyKey,
      sentAt: status === "SIMULATED" || status === "RECORDED" ? nowOf(domain) : null,
    },
  });
  await recordActivity(domain.db, {
    event: "NOTIFICATION_QUEUED",
    actor: domain.actor,
    targetType: "NOTIFICATION",
    targetId: row.id,
    customerId: input.customerId,
    metadata: { status, channel: input.channel, templateKey: input.templateKey, simulated },
  });
  return row;
}

export async function recordManualPayment(
  domain: Domain,
  input: {
    customerId: string;
    amountCents: number;
    currency?: string;
    status: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
    method: string;
    reference: string;
    invoiceNumber?: string;
    simulated?: boolean;
  },
) {
  assertPermission(domain.actor, "payments.reconcile");
  const customer = await domain.db.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new AppError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
  assertSameTenant(domain.actor, customer.tenant);
  if (domain.actor.role === "DEMO_ADMIN") {
    throw new AppError("Demo administrators cannot record payments.", "FORBIDDEN", 403);
  }
  const subscription = await getCurrentSubscription(domain.db, customer.id);
  const payment = await domain.db.payment.create({
    data: {
      tenant: customer.tenant,
      customerId: customer.id,
      subscriptionId: subscription?.id,
      amountCents: input.amountCents,
      currency: input.currency ?? "INR",
      status: input.status,
      method: input.method,
      reference: input.reference,
      invoiceNumber: input.invoiceNumber,
      simulated: Boolean(input.simulated),
      paidAt: input.status === "PAID" ? nowOf(domain) : null,
    },
  });
  await recordActivity(domain.db, {
    event: "PAYMENT_RECORDED",
    actor: domain.actor,
    targetType: "PAYMENT",
    targetId: payment.id,
    customerId: customer.id,
    newValue: { amountCents: input.amountCents, status: input.status, reference: input.reference },
  });
  return payment;
}

export async function recordMaintenance(domain: Domain, machineDbId: string, note: string) {
  assertPermission(domain.actor, "machines.manage");
  const machine = await domain.db.machine.findUnique({ where: { id: machineDbId } });
  if (!machine) throw new AppError("Machine not found.", "MACHINE_NOT_FOUND", 404);
  assertSameTenant(domain.actor, machine.tenant);
  const row = await domain.db.maintenanceRecord.create({
    data: { machineId: machine.id, note, performedBy: domain.actor.email ?? null },
  });
  await recordActivity(domain.db, {
    event: "MAINTENANCE_RECORDED",
    actor: domain.actor,
    targetType: "MACHINE",
    targetId: machine.id,
    machineRef: machine.machineId,
    newValue: { note },
  });
  return row;
}

export async function recordVerifiedHeartbeat(db: PrismaClient, machineDbId: string, at = new Date()) {
  return db.machine.update({
    where: { id: machineDbId },
    data: { lastSeenAt: at, telemetryVerified: true, telemetrySimulated: false },
  });
}

export { isValidMachineIdFormat, parsePlanFeatures };
