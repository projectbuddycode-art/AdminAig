import type { Prisma, PrismaClient } from "@prisma/client";
import { deriveMachineDisplay, toSubscriptionView, effectiveSubscriptionStatus } from "@/lib/entitlement";
import { expireStaleSubscriptions, getCurrentSubscription } from "@/server/domain";
import { parsePlanFeatures } from "@/lib/plan-features";
import { useOfflineDemo } from "@/lib/db-status";
import {
  offlineActivity,
  offlineCustomers,
  offlineDashboardMetrics,
  offlineMachines,
  offlinePlans,
  offlineSubscriptions,
} from "@/server/offline-demo";

function tenantFilter(tenant: string) {
  return { tenant };
}

export async function getDashboardMetrics(db: PrismaClient, tenant = "production") {
  if (await useOfflineDemo()) return offlineDashboardMetrics();
  try {
    return await getDashboardMetricsLive(db, tenant);
  } catch (error) {
    if (await useOfflineDemo()) return offlineDashboardMetrics();
    throw error;
  }
}

async function getDashboardMetricsLive(db: PrismaClient, tenant = "production") {
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
    db.customer.count({ where: { ...scope, deletedAt: null } }),
    db.customer.count({ where: { ...scope, deletedAt: null, status: "ACTIVE" } }),
    db.customer.count({ where: { ...scope, deletedAt: null, status: "SUSPENDED" } }),
    db.customer.count({ where: { ...scope, deletedAt: null, createdAt: { gte: startOfDay } } }),
    db.customer.count({ where: { ...scope, deletedAt: null, createdAt: { gte: weekAgo } } }),
    db.customer.count({ where: { ...scope, deletedAt: null, createdAt: { gte: monthAgo } } }),
    db.customer.count({ where: { ...scope, deletedAt: null, lastLoginAt: { gte: weekAgo } } }),
    db.customer.count({
      where: {
        ...scope,
        deletedAt: null,
        status: "ACTIVE",
        OR: [{ lastLoginAt: null, createdAt: { lt: inactiveBefore } }, { lastLoginAt: { lt: inactiveBefore } }],
      },
    }),
    db.machine.count({ where: { ...scope, deletedAt: null } }),
    db.machine.count({ where: { ...scope, deletedAt: null, status: "ASSIGNED" } }),
    db.machine.count({ where: { ...scope, deletedAt: null, status: "UNASSIGNED" } }),
    db.machine.count({ where: { ...scope, deletedAt: null, status: "SUSPENDED" } }),
    db.machine.count({
      where: { ...scope, deletedAt: null, telemetryVerified: true, telemetrySimulated: false, lastSeenAt: { gte: freshSince } },
    }),
    db.machine.count({
      where: { ...scope, deletedAt: null, lastSeenAt: { lt: freshSince } },
    }),
    db.machine.count({ where: { ...scope, deletedAt: null, OR: [{ status: "SUSPENDED" }, { healthStatus: "ATTENTION" }] } }),
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
  if (await useOfflineDemo()) {
    const sample = offlineCustomers();
    return {
      total: sample.total,
      page: input.page,
      pageSize: input.pageSize,
      rows: sample.rows.map((customer) => ({
        ...customer,
        subscription: {
          planName: customer.subscriptions[0]?.plan.name ?? "—",
          status: customer.subscriptions[0]?.status ?? "NONE",
          expiryDate: customer.subscriptions[0]?.expiryDate ?? null,
        },
        assignedMachineCount: 0,
        assignedMachines: [] as string[],
      })) as never,
      offline: true as const,
    };
  }
  await expireStaleSubscriptions(db);
  const where: Prisma.CustomerWhereInput = { deletedAt: null };
  if (input.tenant) where.tenant = input.tenant;
  if (input.status) where.status = input.status;
  if (input.planId) {
    where.subscriptions = { some: { planId: input.planId } };
  }
  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" } },
      { email: { contains: input.q, mode: "insensitive" } },
      { phone: { contains: input.q, mode: "insensitive" } },
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
  if (!customer || customer.deletedAt) return null;
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
  if (await useOfflineDemo()) {
    const sample = offlineMachines();
    return {
      total: sample.total,
      page: input.page,
      pageSize: input.pageSize,
      rows: sample.rows.map((machine) => ({
        ...machine,
        planName: machine.status === "ASSIGNED" ? "Studio" : null,
        subscriptionStatus: machine.status === "ASSIGNED" ? "ACTIVE" : null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: "production",
      })) as never,
      offline: true as const,
    };
  }
  await expireStaleSubscriptions(db);
  const where: Prisma.MachineWhereInput = { deletedAt: null };
  if (input.tenant) where.tenant = input.tenant;
  if (input.q) {
    where.OR = [
      { machineId: { contains: input.q.toUpperCase(), mode: "insensitive" } },
      { customer: { name: { contains: input.q, mode: "insensitive" } } },
    ];
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
  if (!machine || machine.deletedAt) return null;
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
  if (await useOfflineDemo()) {
    return offlinePlans().map((plan) => ({
      ...plan,
      description: "Offline demo plan",
      currency: "INR",
      featuresJson: "{}",
      features: parsePlanFeatures("{}"),
      subscriberCount: 2,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      priceAmount: null as never,
    })) as never;
  }
  const plans = await db.plan.findMany({
    where: { deletedAt: null, ...(tenant ? { tenant } : {}) },
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
  if (!plan || plan.deletedAt) return null;
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
  if (await useOfflineDemo()) {
    const rows = offlineSubscriptions();
    return { total: rows.length, page: input.page, pageSize: input.pageSize, rows: rows as never };
  }
  await expireStaleSubscriptions(db);
  const where: Prisma.SubscriptionWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.status) where.status = input.status;
  if (input.q) {
    where.OR = [
      { customer: { name: { contains: input.q, mode: "insensitive" } } },
      { customer: { email: { contains: input.q, mode: "insensitive" } } },
      { plan: { name: { contains: input.q, mode: "insensitive" } } },
    ];
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
  if (await useOfflineDemo()) {
    const rows = offlineActivity();
    return { total: rows.length, page: input.page, pageSize: input.pageSize, rows: rows as never };
  }
  const where: Prisma.ActivityLogWhereInput = {};
  if (input.tenant) where.tenant = input.tenant;
  if (input.targetType) where.targetType = input.targetType;
  if (input.event) where.event = input.event;
  if (input.actor) where.actorEmail = { contains: input.actor, mode: "insensitive" };
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
      { event: { contains: input.q.toUpperCase(), mode: "insensitive" } },
      { actorEmail: { contains: input.q, mode: "insensitive" } },
      { targetType: { contains: input.q.toUpperCase(), mode: "insensitive" } },
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
    where: { status: "UNASSIGNED", deletedAt: null, ...(tenant ? { tenant } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function listActivePlans(db: PrismaClient, tenant?: string) {
  return db.plan.findMany({ where: { status: "ACTIVE", deletedAt: null, ...(tenant ? { tenant } : {}) }, orderBy: { name: "asc" } });
}

export { getCurrentSubscription };
