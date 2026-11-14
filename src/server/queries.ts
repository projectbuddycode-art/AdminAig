import type { Prisma, PrismaClient } from "@prisma/client";
import { deriveMachineDisplay, toSubscriptionView, effectiveSubscriptionStatus } from "@/lib/entitlement";
import { expireStaleSubscriptions, getCurrentSubscription } from "@/server/domain";
import { parsePlanFeatures } from "@/lib/plan-features";

function tenantFilter(tenant: string) {
  return { tenant };
}

export async function getDashboardMetrics(db: PrismaClient, tenant = "production") {
  await expireStaleSubscriptions(db);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now);
  monthAgo.setDate(1);
  monthAgo.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const freshSince = new Date(now.getTime() - 15 * 60 * 1000);
  const inactiveBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const scope = tenantFilter(tenant);

  const [
    totalCustomers,
    activeCustomers,
    suspendedCustomers,
    newToday,
    newWeek,
    newMonth,
    recentLogins,
    inactiveCustomers,
    totalMachines,
    assignedMachines,
    unassignedMachines,
    suspendedMachines,
    onlineMachines,
    offlineMachines,
    attentionMachines,
    activeSubscriptions,
    expiringSubscriptions,
    expiredSubscriptions,
    suspendedSubscriptions,
    recentActivity,
    usageSuccess,
    usageFailed,
    usageTotal,
    exportMonth,
    payments,
  ] = await Promise.all([
    db.customer.count({ where: scope }),
    db.customer.count({ where: { ...scope, status: "ACTIVE" } }),
    db.customer.count({ where: { ...scope, status: "SUSPENDED" } }),
    db.customer.count({ where: { ...scope, createdAt: { gte: startOfDay } } }),
    db.customer.count({ where: { ...scope, createdAt: { gte: weekAgo } } }),
    db.customer.count({ where: { ...scope, createdAt: { gte: monthAgo } } }),
    db.customer.count({ where: { ...scope, lastLoginAt: { gte: weekAgo } } }),
    db.customer.count({
      where: {
        ...scope,
        status: "ACTIVE",
        OR: [{ lastLoginAt: null, createdAt: { lt: inactiveBefore } }, { lastLoginAt: { lt: inactiveBefore } }],
      },
    }),
    db.machine.count({ where: scope }),
    db.machine.count({ where: { ...scope, status: "ASSIGNED" } }),
    db.machine.count({ where: { ...scope, status: "UNASSIGNED" } }),
    db.machine.count({ where: { ...scope, status: "SUSPENDED" } }),
    db.machine.count({
      where: { ...scope, telemetryVerified: true, telemetrySimulated: false, lastSeenAt: { gte: freshSince } },
    }),
    db.machine.count({
      where: { ...scope, lastSeenAt: { lt: freshSince } },
    }),
    db.machine.count({ where: { ...scope, OR: [{ status: "SUSPENDED" }, { healthStatus: "ATTENTION" }] } }),
    db.subscription.count({ where: { ...scope, status: "ACTIVE", expiryDate: { gt: now } } }),
    db.subscription.count({
      where: { ...scope, status: "ACTIVE", expiryDate: { gt: now, lte: inSevenDays } },
    }),
    db.subscription.count({ where: { ...scope, status: "EXPIRED" } }),
    db.subscription.count({ where: { ...scope, status: "SUSPENDED" } }),
    db.activityLog.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 8 }),
    db.usageEntry.count({ where: { ...scope, status: "SUCCESS" } }),
    db.usageEntry.count({ where: { ...scope, status: "FAILED" } }),
    db.usageEntry.count({ where: scope }),
    db.usageEntry.count({ where: { ...scope, status: "SUCCESS", exportDate: { gte: monthAgo } } }),
    db.payment.findMany({ where: { ...scope, simulated: false } }),
  ]);

  const collected = payments.filter((row) => row.status === "PAID").reduce((sum, row) => sum + row.amountCents, 0);
  const monthlyCollected = payments
    .filter((row) => row.status === "PAID" && row.paidAt && row.paidAt >= monthAgo)
    .reduce((sum, row) => sum + row.amountCents, 0);
  const pending = payments.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + row.amountCents, 0);
  const failed = payments.filter((row) => row.status === "FAILED").length;
  const refunds = payments.filter((row) => row.status === "REFUNDED").reduce((sum, row) => sum + row.amountCents, 0);

  return {
    totalCustomers,
    activeCustomers,
    suspendedCustomers,
    inactiveCustomers,
    newToday,
    newWeek,
    newMonth,
    recentLogins,
    totalMachines,
    activeMachines: assignedMachines,
    unassignedMachines,
    suspendedMachines,
    onlineMachines,
    offlineMachines,
    attentionMachines,
    activeSubscriptions,
    expiringSubscriptions,
    expiredSubscriptions,
    suspendedSubscriptions,
    usageTotal,
    usageSuccess,
    usageFailed,
    exportMonth,
    collectedCents: collected,
    monthlyCollectedCents: monthlyCollected,
    pendingCents: pending,
    failedPayments: failed,
    refundCents: refunds,
    recentActivity,
  };
}

export async function listCustomers(
  db: PrismaClient,
  input: { q: string; status: string; page: number; pageSize: number; planId?: string; tenant?: string },
) {
  await expireStaleSubscriptions(db);
  const where: Prisma.CustomerWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.status) where.status = input.status;
  if (input.planId) {
    where.subscriptions = { some: { planId: input.planId } };
  }
  if (input.q) {
    where.OR = [
      { name: { contains: input.q } },
      { email: { contains: input.q } },
      { phone: { contains: input.q } },
    ];
  }
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        machines: true,
      },
    }),
  ]);

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    rows: rows.map((customer) => {
      const subscription = toSubscriptionView(customer.subscriptions[0] ?? null);
      return {
        ...customer,
        subscription,
        assignedMachineCount: customer.machines.length,
        assignedMachines: customer.machines.map((machine) => machine.machineId),
      };
    }),
  };
}

export async function getCustomerDetail(db: PrismaClient, id: string, tenant?: string) {
  await expireStaleSubscriptions(db);
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      machines: true,
      assignments: { include: { machine: true }, orderBy: { assignedAt: "desc" } },
    },
  });
  if (!customer) return null;
  if (tenant && customer.tenant !== tenant) return null;

  const current = toSubscriptionView(customer.subscriptions[0] ?? null);
  const [usage, payments, notifications, logins] = await Promise.all([
    db.usageEntry.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payment.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notificationMessage.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.loginEvent.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const activity = await db.activityLog.findMany({
    where: {
      OR: [
        { targetType: "CUSTOMER", targetId: customer.id },
        { targetId: { in: customer.machines.map((m) => m.id) } },
        { targetId: { in: customer.subscriptions.map((s) => s.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    customer,
    currentSubscription: current,
    machines: customer.machines.map((machine) => ({
      machine,
      display: deriveMachineDisplay({
        accountStatus: machine.status,
        customer,
        subscription: current,
        lastSeenAt: machine.lastSeenAt,
        telemetryVerified: machine.telemetryVerified,
        telemetrySimulated: machine.telemetrySimulated,
      }),
    })),
    assignments: customer.assignments,
    activity,
    usage,
    payments,
    notifications,
    logins,
  };
}

export async function listMachines(
  db: PrismaClient,
  input: { q: string; status: string; page: number; pageSize: number; tenant?: string },
) {
  await expireStaleSubscriptions(db);
  const where: Prisma.MachineWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.q) {
    where.OR = [{ machineId: { contains: input.q.toUpperCase() } }, { customer: { name: { contains: input.q } } }];
  }
  if (input.status === "UNASSIGNED" || input.status === "ASSIGNED" || input.status === "SUSPENDED") {
    where.status = input.status;
  }

  const [total, rows] = await Promise.all([
    db.machine.count({ where }),
    db.machine.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: { customer: { include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
  ]);

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    rows: rows.map((machine) => {
      const subscription = toSubscriptionView(machine.customer?.subscriptions[0] ?? null);
      const display = deriveMachineDisplay({
        accountStatus: machine.status,
        customer: machine.customer,
        subscription,
        lastSeenAt: machine.lastSeenAt,
        telemetryVerified: machine.telemetryVerified,
        telemetrySimulated: machine.telemetrySimulated,
      });
      return {
        ...machine,
        planName: subscription?.planName ?? null,
        subscriptionStatus: subscription?.status ?? null,
        display,
      };
    }),
  };
}

export async function getMachineDetail(db: PrismaClient, id: string, tenant?: string) {
  await expireStaleSubscriptions(db);
  const machine = await db.machine.findUnique({
    where: { id },
    include: {
      customer: { include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
      assignments: { include: { customer: true }, orderBy: { assignedAt: "desc" } },
    },
  });
  if (!machine) return null;
  if (tenant && machine.tenant !== tenant) return null;
  const subscription = toSubscriptionView(machine.customer?.subscriptions[0] ?? null);
  const [usage, maintenance, errors] = await Promise.all([
    db.usageEntry.findMany({ where: { machineId: machine.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.maintenanceRecord.findMany({ where: { machineId: machine.id }, orderBy: { createdAt: "desc" } }),
    db.machineError.findMany({ where: { machineId: machine.id }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const activity = await db.activityLog.findMany({
    where: { targetType: "MACHINE", targetId: machine.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return {
    machine,
    subscription,
    display: deriveMachineDisplay({
      accountStatus: machine.status,
      customer: machine.customer,
      subscription,
      lastSeenAt: machine.lastSeenAt,
      telemetryVerified: machine.telemetryVerified,
      telemetrySimulated: machine.telemetrySimulated,
    }),
    assignments: machine.assignments,
    activity,
    usage,
    maintenance,
    errors,
  };
}

export async function listPlans(db: PrismaClient, tenant?: string) {
  const plans = await db.plan.findMany({
    where: tenant ? { tenant } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  return plans.map((plan) => ({
    ...plan,
    features: parsePlanFeatures(plan.featuresJson),
    subscriberCount: plan._count.subscriptions,
  }));
}

export async function getPlanDetail(db: PrismaClient, id: string, tenant?: string) {
  const plan = await db.plan.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!plan) return null;
  if (tenant && plan.tenant !== tenant) return null;
  return {
    ...plan,
    features: parsePlanFeatures(plan.featuresJson),
    subscriptions: plan.subscriptions.map((row) => ({
      ...row,
      status: effectiveSubscriptionStatus(row.status, row.expiryDate),
    })),
  };
}

export async function listSubscriptions(
  db: PrismaClient,
  input: { q: string; status: string; page: number; pageSize: number; tenant?: string },
) {
  await expireStaleSubscriptions(db);
  const where: Prisma.SubscriptionWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.status) where.status = input.status;
  if (input.q) {
    where.OR = [{ customer: { name: { contains: input.q } } }, { customer: { email: { contains: input.q } } }, { plan: { name: { contains: input.q } } }];
  }
  const [total, rows] = await Promise.all([
    db.subscription.count({ where }),
    db.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: { customer: true, plan: true },
    }),
  ]);
  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    rows: rows.map((row) => ({
      ...row,
      status: effectiveSubscriptionStatus(row.status, row.expiryDate),
    })),
  };
}

export async function listActivity(
  db: PrismaClient,
  input: {
    q: string;
    page: number;
    pageSize: number;
    event?: string;
    actor?: string;
    from?: string;
    to?: string;
    tenant?: string;
    targetType?: string;
  },
) {
  const where: Prisma.ActivityLogWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.targetType) where.targetType = input.targetType;
  if (input.event) where.event = input.event;
  if (input.actor) where.actorEmail = { contains: input.actor };
  if (input.from || input.to) {
    where.createdAt = {};
    if (input.from) where.createdAt.gte = new Date(input.from);
    if (input.to) {
      const end = new Date(input.to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (input.q) {
    where.OR = [
      { event: { contains: input.q.toUpperCase() } },
      { actorEmail: { contains: input.q } },
      { targetType: { contains: input.q.toUpperCase() } },
    ];
  }
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);
  return { total, page: input.page, pageSize: input.pageSize, rows };
}

export async function listAssignableMachines(db: PrismaClient, tenant?: string) {
  return db.machine.findMany({
    where: { status: "UNASSIGNED", ...(tenant ? { tenant } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function listActivePlans(db: PrismaClient, tenant?: string) {
  return db.plan.findMany({ where: { status: "ACTIVE", ...(tenant ? { tenant } : {}) }, orderBy: { name: "asc" } });
}

export { getCurrentSubscription };
