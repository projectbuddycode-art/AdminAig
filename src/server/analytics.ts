import type { Prisma, PrismaClient } from "@prisma/client";
import { format } from "date-fns";
import type { ReportRange } from "@/lib/report-range";
import { idIn, idsBetween, idsOnOrBefore } from "@/server/sqlite-dates";

export type ReportSection = "overview" | "customers" | "machines" | "usage" | "subscriptions" | "finance" | "activity";

export type ReportFilters = {
  tenant: string;
  range: ReportRange;
  customerId?: string;
  machineId?: string;
  planId?: string;
  status?: string;
  q?: string;
  page: number;
  pageSize: number;
  adminEmail?: string;
  action?: string;
};

export type Kpi = {
  label: string;
  value: number | null;
  previous: number | null;
  format: "number" | "money" | "percent";
  note?: string;
};

export type Point = { label: string; value: number };
export type Slice = { label: string; value: number; color: string };

const FRESH_MS = 15 * 60 * 1000;

function bucket(dates: Date[], grain: "day" | "month"): Point[] {
  const map = new Map<string, number>();
  for (const date of dates) {
    const key = format(date, grain === "month" ? "yyyy-MM" : "MM-dd");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

function customerWhere(filters: ReportFilters, ids: string[]): Prisma.CustomerWhereInput {
  const pool = filters.customerId ? ids.filter((id) => id === filters.customerId) : ids;
  const where: Prisma.CustomerWhereInput = {
    tenant: filters.tenant,
    id: idIn(pool),
  };
  if (filters.status) where.status = filters.status;
  if (filters.q) where.OR = [{ name: { contains: filters.q } }, { email: { contains: filters.q } }];
  if (filters.planId) where.subscriptions = { some: { planId: filters.planId } };
  if (filters.machineId) where.machines = { some: { id: filters.machineId } };
  return where;
}

export async function getAnalytics(db: PrismaClient, section: ReportSection, filters: ReportFilters) {
  const { range } = filters;
  const generatedAt = new Date();
  const [current, previous] = await Promise.all([
    sectionMetrics(db, section, filters, range.from, range.to),
    sectionMetrics(db, section, filters, range.previousFrom, range.previousTo),
  ]);
  return {
    generatedAt,
    section,
    range,
    kpis: current.kpis.map((kpi, index) => ({ ...kpi, previous: previous.kpis[index]?.value ?? null })),
    charts: current.charts,
    tables: current.tables,
    notes: current.notes,
    total: current.total,
  };
}

async function sectionMetrics(db: PrismaClient, section: ReportSection, filters: ReportFilters, from: Date, to: Date) {
  if (section === "machines") return machineMetrics(db, filters, from, to);
  if (section === "usage") return usageMetrics(db, filters, from, to);
  if (section === "subscriptions") return subscriptionMetrics(db, filters, from, to);
  if (section === "finance") return financeMetrics(db, filters, from, to);
  if (section === "activity") return activityMetrics(db, filters, from, to);
  if (section === "overview") return overviewMetrics(db, filters, from, to);
  return customerMetrics(db, filters, from, to);
}

async function customerMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const existingIds = await idsOnOrBefore(db, "Customer", to, filters.tenant);
  const createdIds = new Set(await idsBetween(db, "Customer", from, to, filters.tenant));
  const usageIds = await idsBetween(db, "UsageEntry", from, to, filters.tenant);
  const usageRows = usageIds.length
    ? await db.usageEntry.findMany({ where: { id: idIn(usageIds) }, select: { customerId: true } })
    : [];
  const usedCustomers = new Set(usageRows.map((row) => row.customerId));
  const people = await db.customer.findMany({
    where: customerWhere(filters, existingIds),
    select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, demoLabel: true },
  });
  const inactiveBefore = to.getTime() - 30 * 24 * 60 * 60 * 1000;
  const total = people.length;
  const active = people.filter((row) => row.status === "ACTIVE").length;
  const suspended = people.filter((row) => row.status === "SUSPENDED").length;
  const createdRows = people.filter((row) => createdIds.has(row.id));
  const inactive = people.filter(
    (row) => row.status === "ACTIVE" && row.createdAt.getTime() < inactiveBefore && (!row.lastLoginAt || row.lastLoginAt.getTime() < inactiveBefore),
  ).length;
  const cohortRows = people.filter((row) => row.createdAt.getTime() < from.getTime());
  const retained = cohortRows.filter(
    (row) => (row.lastLoginAt && row.lastLoginAt.getTime() >= from.getTime() && row.lastLoginAt.getTime() <= to.getTime()) || usedCustomers.has(row.id),
  ).length;
  const cohort = cohortRows.length;
  const subscriptionIds = await idsOnOrBefore(db, "Subscription", to, filters.tenant);
  const plans = await db.subscription.groupBy({
    by: ["planId"],
    where: { tenant: filters.tenant, id: idIn(subscriptionIds), ...(filters.planId ? { planId: filters.planId } : {}) },
    _count: { _all: true },
  });
  const planRows = await db.plan.findMany({
    where: { id: { in: plans.map((row) => row.planId) }, tenant: filters.tenant },
    select: { id: true, name: true },
  });
  const grain = to.getTime() - from.getTime() > 90 * 86400000 ? "month" : "day";
  const latest = createdRows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
  const retention = cohort === 0 ? null : Math.round((retained / cohort) * 1000) / 10;
  return {
    total: createdRows.length,
    notes: [
      "Inactive means an active account with no login in the 30 days before the end of the range.",
      "Retention is customers who existed before this range and logged in or recorded usage during it. It is omitted when that cohort is empty.",
    ],
    kpis: [
      { label: "Total customers", value: total, previous: null, format: "number" as const },
      { label: "Active customers", value: active, previous: null, format: "number" as const },
      { label: "New customers", value: createdRows.length, previous: null, format: "number" as const },
      { label: "Inactive customers", value: inactive, previous: null, format: "number" as const },
      { label: "Suspended customers", value: suspended, previous: null, format: "number" as const },
      { label: "Retention", value: retention, previous: null, format: "percent" as const },
    ],
    charts: {
      acquisition: bucket(createdRows.map((row) => row.createdAt), grain),
      split: [
        { label: "Active", value: active, color: "#2c7a4a" },
        { label: "Inactive", value: inactive, color: "#8d6414" },
        { label: "Suspended", value: suspended, color: "#9b1c2a" },
      ],
      byMonth: bucket(createdRows.map((row) => row.createdAt), "month"),
      plans: plans.map((row, index) => ({
        label: planRows.find((plan) => plan.id === row.planId)?.name ?? "Plan",
        value: row._count._all,
        color: ["#1e3a5f", "#3d6f9a", "#2c7a4a", "#8d6414", "#9b1c2a"][index % 5],
      })),
    },
    tables: { latest },
  };
}

async function overviewMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const customers = await customerMetrics(db, filters, from, to);
  const usage = await usageMetrics(db, filters, from, to);
  const finance = await financeMetrics(db, filters, from, to);
  return {
    total: customers.total,
    notes: ["Overview figures use the same ledger and payment rules as the detailed sections."],
    kpis: [
      customers.kpis[2],
      customers.kpis[1],
      usage.kpis[1],
      usage.kpis[4],
      finance.kpis[0],
      finance.kpis[2],
    ],
    charts: {
      acquisition: customers.charts.acquisition,
      split: usage.charts.split,
      byMonth: finance.charts.byMonth,
      plans: customers.charts.plans,
    },
    tables: customers.tables,
  };
}

async function usageWhere(db: PrismaClient, filters: ReportFilters, from: Date, to: Date): Promise<Prisma.UsageEntryWhereInput> {
  const ids = await idsBetween(db, "UsageEntry", from, to, filters.tenant);
  return {
    tenant: filters.tenant,
    id: idIn(ids),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.machineId ? { machineId: filters.machineId } : {}),
    ...(filters.planId ? { customer: { subscriptions: { some: { planId: filters.planId } } } } : {}),
  };
}

async function usageMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const where = await usageWhere(db, filters, from, to);
  const [rows, success, failed, credits, storage, recordings] = await Promise.all([
    db.usageEntry.findMany({ where, select: { createdAt: true, status: true, creditsConsumed: true, durationMs: true, customerId: true } }),
    db.usageEntry.count({ where: { ...where, status: "SUCCESS" } }),
    db.usageEntry.count({ where: { ...where, status: "FAILED" } }),
    db.usageEntry.aggregate({ where: { ...where, status: "SUCCESS" }, _sum: { creditsConsumed: true } }),
    db.usageEntry.aggregate({ where: { ...where, status: "SUCCESS" }, _sum: { storageMb: true } }),
    db.usageEntry.count({ where: { ...where, sourceRecording: { not: null } } }),
  ]);
  const durations = { "0-5s": 0, "5-15s": 0, "15-60s": 0, "60s+": 0 };
  for (const row of rows) {
    if (row.durationMs == null) continue;
    const seconds = row.durationMs / 1000;
    if (seconds < 5) durations["0-5s"] += 1;
    else if (seconds < 15) durations["5-15s"] += 1;
    else if (seconds < 60) durations["15-60s"] += 1;
    else durations["60s+"] += 1;
  }
  const byCustomer = new Map<string, { jobs: number; exports: number; credits: number }>();
  for (const row of rows) {
    const current = byCustomer.get(row.customerId) ?? { jobs: 0, exports: 0, credits: 0 };
    current.jobs += 1;
    if (row.status === "SUCCESS") {
      current.exports += 1;
      current.credits += row.creditsConsumed;
    }
    byCustomer.set(row.customerId, current);
  }
  const rankedIds = [...byCustomer.entries()].sort((a, b) => b[1].exports - a[1].exports).slice(0, 10);
  const people = await db.customer.findMany({
    where: { id: { in: rankedIds.map(([id]) => id) }, tenant: filters.tenant },
    select: { id: true, name: true, demoLabel: true, subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } },
  });
  const ranked = rankedIds.map(([id, stats]) => {
    const person = people.find((row) => row.id === id);
    const subscription = person?.subscriptions[0];
    const allowed = subscription?.exportAllowance ?? 0;
    const consumed = subscription?.exportsUsed ?? stats.exports;
    return {
      id,
      name: person?.name ?? id,
      plan: subscription?.plan.name ?? "—",
      allowed,
      consumed,
      remaining: Math.max(0, allowed - consumed),
      utilization: allowed > 0 ? Math.round((consumed / allowed) * 1000) / 10 : null,
      exports: stats.exports,
      demoLabel: person?.demoLabel,
    };
  });
  return {
    total: rows.length,
    notes: ["Failed jobs are not counted as exports or credits. Recording sessions are counted only when a source recording was stored."],
    kpis: [
      { label: "Recording sessions", value: recordings, previous: null, format: "number" as const },
      { label: "Processing jobs", value: rows.length, previous: null, format: "number" as const },
      { label: "Successful jobs", value: success, previous: null, format: "number" as const },
      { label: "Failed jobs", value: failed, previous: null, format: "number" as const },
      { label: "Exports", value: success, previous: null, format: "number" as const, note: "Successful ledger rows" },
      { label: "Credits consumed", value: credits._sum.creditsConsumed ?? 0, previous: null, format: "number" as const },
      { label: "Storage (MB)", value: storage._sum.storageMb ?? 0, previous: null, format: "number" as const, note: "Sum of recorded storage only" },
    ],
    charts: {
      acquisition: bucket(rows.map((row) => row.createdAt), to.getTime() - from.getTime() > 90 * 86400000 ? "month" : "day"),
      split: [
        { label: "Successful", value: success, color: "#2c7a4a" },
        { label: "Failed", value: failed, color: "#9b1c2a" },
      ],
      byMonth: ranked.slice(0, 8).map((row) => ({ label: row.name, value: row.exports })),
      plans: Object.entries(durations).map(([label, value], index) => ({
        label,
        value,
        color: ["#1e3a5f", "#3d6f9a", "#8d6414", "#9b1c2a"][index],
      })),
    },
    tables: { ranked },
  };
}

async function machineMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const now = new Date();
  const freshSince = new Date(now.getTime() - FRESH_MS);
  const where: Prisma.MachineWhereInput = {
    tenant: filters.tenant,
    ...(filters.machineId ? { id: filters.machineId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.q ? { OR: [{ machineId: { contains: filters.q.toUpperCase() } }, { serialNumber: { contains: filters.q } }] } : {}),
  };
  const machines = await db.machine.findMany({
    where,
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const machineIds = machines.map((machine) => machine.id);
  const usageIds = await idsBetween(db, "UsageEntry", from, to, filters.tenant);
  const errorIds = await idsBetween(db, "MachineError", from, to);
  const maintenanceIds = await idsBetween(db, "MaintenanceRecord", from, to);
  const usage = machineIds.length
    ? await db.usageEntry.groupBy({
        by: ["machineId", "status"],
        where: { tenant: filters.tenant, id: idIn(usageIds), machineId: { in: machineIds } },
        _count: { _all: true },
      })
    : [];
  const errors = machineIds.length
    ? await db.machineError.groupBy({
        by: ["machineId"],
        where: { machineId: { in: machineIds }, id: idIn(errorIds) },
        _count: { _all: true },
      })
    : [];
  const maintenance = machineIds.length
    ? await db.maintenanceRecord.count({ where: { machineId: { in: machineIds }, id: idIn(maintenanceIds) } })
    : 0;
  const errorTotal = errors.reduce((sum, row) => sum + row._count._all, 0);
  const online = machines.filter((machine) => machine.telemetryVerified && !machine.telemetrySimulated && machine.lastSeenAt && machine.lastSeenAt >= freshSince).length;
  const simulated = machines.filter((machine) => machine.telemetrySimulated && machine.lastSeenAt && machine.lastSeenAt >= freshSince).length;
  const offline = machines.filter((machine) => machine.lastSeenAt && machine.lastSeenAt < freshSince).length;
  const rows = machines.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).map((machine) => {
    const sessions = usage.filter((row) => row.machineId === machine.id);
    const failed = sessions.find((row) => row.status === "FAILED")?._count._all ?? 0;
    const totalSessions = sessions.reduce((sum, row) => sum + row._count._all, 0);
    let connectivity = "No heartbeat recorded";
    if (machine.telemetryVerified && !machine.telemetrySimulated && machine.lastSeenAt && machine.lastSeenAt >= freshSince) connectivity = "Online";
    else if (machine.telemetrySimulated && machine.lastSeenAt && machine.lastSeenAt >= freshSince) connectivity = "Simulated heartbeat";
    else if (machine.lastSeenAt) connectivity = "Last recorded offline";
    return {
      id: machine.id,
      machineId: machine.machineId,
      serialNumber: machine.serialNumber,
      customer: machine.customer?.name ?? "Unassigned",
      customerId: machine.customer?.id ?? null,
      model: machine.model,
      firmwareVersion: machine.firmwareVersion,
      lastSeenAt: machine.lastSeenAt,
      connectivity,
      totalSessions,
      failed,
      errors: errors.find((row) => row.machineId === machine.id)?._count._all ?? 0,
      demoLabel: machine.demoLabel,
    };
  });
  const activityDates = await db.usageEntry.findMany({
    where: { tenant: filters.tenant, id: idIn(usageIds), ...(filters.machineId ? { machineId: filters.machineId } : {}) },
    select: { createdAt: true },
  });
  const byModel = new Map<string, number>();
  for (const machine of machines) byModel.set(machine.model, (byModel.get(machine.model) ?? 0) + 1);
  return {
    total: machines.length,
    notes: [
      "Online requires a verified, non-simulated heartbeat in the last 15 minutes. Older timestamps are last recorded status, not a live connection.",
      simulated > 0 ? `${simulated} machine(s) have a simulated demo heartbeat and are not counted as online.` : "No simulated heartbeats are counted as online.",
    ],
    kpis: [
      { label: "Registered machines", value: machines.length, previous: null, format: "number" as const },
      { label: "Online now", value: online, previous: null, format: "number" as const, note: "Verified heartbeat" },
      { label: "Offline by last heartbeat", value: offline, previous: null, format: "number" as const },
      { label: "Recorded errors", value: errorTotal, previous: null, format: "number" as const },
      { label: "Maintenance records", value: maintenance, previous: null, format: "number" as const },
    ],
    charts: {
      acquisition: bucket(activityDates.map((row) => row.createdAt), "day"),
      split: [
        { label: "Online", value: online, color: "#2c7a4a" },
        { label: "Last recorded offline", value: offline, color: "#9b1c2a" },
        { label: "No heartbeat", value: Math.max(0, machines.length - online - offline - simulated), color: "#5c6b7a" },
        { label: "Simulated", value: simulated, color: "#8d6414" },
      ],
      byMonth: [...byModel.entries()].map(([label, value]) => ({ label, value })),
      plans: [{ label: "Errors", value: errorTotal, color: "#9b1c2a" }],
    },
    tables: { machines: rows },
  };
}

async function subscriptionMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const where: Prisma.SubscriptionWhereInput = {
    tenant: filters.tenant,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.planId ? { planId: filters.planId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { customer: { OR: [{ name: { contains: filters.q } }, { email: { contains: filters.q } }] } } : {}),
  };
  const rows = await db.subscription.findMany({
    where,
    include: { customer: true, plan: true },
    orderBy: { createdAt: "desc" },
  });
  const inRange = rows.filter((row) => row.createdAt >= from && row.createdAt <= to);
  const active = rows.filter((row) => row.status === "ACTIVE" && row.expiryDate > to).length;
  const expired = rows.filter((row) => row.status === "EXPIRED" || row.expiryDate <= to).length;
  const suspended = rows.filter((row) => row.status === "SUSPENDED").length;
  const trials = rows.filter((row) => row.status === "TRIAL").length;
  const expiring = rows.filter((row) => row.status === "ACTIVE" && row.expiryDate > to && row.expiryDate.getTime() - to.getTime() <= 14 * 86400000).length;
  const paidIds = await idsBetween(db, "Payment", from, to, filters.tenant);
  const paid = await db.payment.aggregate({
    where: { tenant: filters.tenant, simulated: false, status: "PAID", id: idIn(paidIds), paidAt: { not: null } },
    _sum: { amountCents: true },
  });
  const planMap = new Map<string, number>();
  for (const row of rows) planMap.set(row.plan.name, (planMap.get(row.plan.name) ?? 0) + 1);
  const pageRows = inRange.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).map((row) => ({
    id: row.customerId,
    customer: row.customer.name,
    plan: row.plan.name,
    status: row.status,
    startDate: row.startDate,
    expiryDate: row.expiryDate,
    priceCents: row.plan.priceCents,
    demoLabel: row.customer.demoLabel,
  }));
  return {
    total: inRange.length,
    notes: [
      "Collected subscription cash is the sum of non-simulated PAID payments in the range. Plan prices are not treated as revenue.",
      trials === 0 ? "No subscription is stored with status TRIAL." : "",
    ].filter(Boolean),
    kpis: [
      { label: "Subscriptions in view", value: rows.length, previous: null, format: "number" as const },
      { label: "Active", value: active, previous: null, format: "number" as const },
      { label: "Trials", value: trials, previous: null, format: "number" as const },
      { label: "Expiring within 14 days", value: expiring, previous: null, format: "number" as const },
      { label: "Expired", value: expired, previous: null, format: "number" as const },
      { label: "Suspended", value: suspended, previous: null, format: "number" as const },
      { label: "Collected in range", value: paid._sum.amountCents ?? 0, previous: null, format: "money" as const, note: "Verified payments only" },
    ],
    charts: {
      acquisition: bucket(inRange.map((row) => row.createdAt), "month"),
      split: [...planMap.entries()].map(([label, value], index) => ({
        label,
        value,
        color: ["#1e3a5f", "#3d6f9a", "#2c7a4a", "#8d6414"][index % 4],
      })),
      byMonth: bucket(rows.filter((row) => row.expiryDate >= from && row.expiryDate <= to).map((row) => row.expiryDate), "month"),
      plans: [],
    },
    tables: { subscriptions: pageRows },
  };
}

async function financeMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const paymentIds = await idsBetween(db, "Payment", from, to, filters.tenant);
  const where: Prisma.PaymentWhereInput = {
    tenant: filters.tenant,
    id: idIn(paymentIds),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { OR: [{ reference: { contains: filters.q } }, { customer: { name: { contains: filters.q } } }] } : {}),
  };
  const payments = await db.payment.findMany({
    where,
    include: { customer: { select: { id: true, name: true, demoLabel: true } } },
    orderBy: { createdAt: "desc" },
  });
  const collected = payments.filter((row) => row.status === "PAID" && !row.simulated);
  const simulated = payments.filter((row) => row.simulated);
  const pending = payments.filter((row) => row.status === "PENDING" && !row.simulated);
  const failed = payments.filter((row) => row.status === "FAILED" && !row.simulated);
  const refunded = payments.filter((row) => row.status === "REFUNDED" && !row.simulated);
  const sum = (rows: typeof payments) => rows.reduce((total, row) => total + row.amountCents, 0);
  const pageRows = payments.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize);
  return {
    total: payments.length,
    notes: [
      "Collected revenue counts only status PAID and simulated = false. Simulated demo payments are listed separately and are not revenue.",
    ],
    kpis: [
      { label: "Collected", value: sum(collected), previous: null, format: "money" as const },
      { label: "Pending", value: sum(pending), previous: null, format: "money" as const },
      { label: "Failed payments", value: failed.length, previous: null, format: "number" as const },
      { label: "Refunded", value: sum(refunded), previous: null, format: "money" as const },
      { label: "Simulated, not collected", value: sum(simulated.filter((row) => row.status === "PAID")), previous: null, format: "money" as const },
    ],
    charts: {
      acquisition: bucket(collected.map((row) => row.paidAt ?? row.createdAt), "month"),
      split: [
        { label: "Collected", value: collected.length, color: "#2c7a4a" },
        { label: "Pending", value: pending.length, color: "#8d6414" },
        { label: "Failed", value: failed.length, color: "#9b1c2a" },
        { label: "Simulated", value: simulated.length, color: "#5c6b7a" },
      ],
      byMonth: [],
      plans: [],
    },
    tables: {
      payments: pageRows.map((row) => ({
        id: row.customer.id,
        customer: row.customer.name,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.simulated ? "SIMULATED" : row.status,
        reference: row.reference,
        createdAt: row.createdAt,
        demoLabel: row.demoLabel ?? row.customer.demoLabel,
      })),
    },
  };
}

async function activityMetrics(db: PrismaClient, filters: ReportFilters, from: Date, to: Date) {
  const loginIds = await idsBetween(db, "LoginEvent", from, to, filters.tenant);
  const auditIds = await idsBetween(db, "ActivityLog", from, to, filters.tenant);
  const loginWhere: Prisma.LoginEventWhereInput = {
    tenant: filters.tenant,
    id: idIn(loginIds),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
  const [logins, failed, successRows, auditCount, audit] = await Promise.all([
    db.loginEvent.count({ where: { ...loginWhere, success: true, actorType: "CUSTOMER" } }),
    db.loginEvent.count({ where: { ...loginWhere, success: false } }),
    db.loginEvent.findMany({
      where: { ...loginWhere, success: true, actorType: "CUSTOMER" },
      select: { createdAt: true, customerId: true, actorId: true },
    }),
    db.activityLog.count({
      where: {
        tenant: filters.tenant,
        id: idIn(auditIds),
        ...(filters.action ? { event: filters.action } : {}),
        ...(filters.adminEmail ? { actorEmail: { contains: filters.adminEmail } } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
    }),
    db.activityLog.findMany({
      where: {
        tenant: filters.tenant,
        id: idIn(auditIds),
        ...(filters.action ? { event: filters.action } : {}),
        ...(filters.adminEmail ? { actorEmail: { contains: filters.adminEmail } } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  const dayKey = format(to, "yyyy-MM-dd");
  const daily = new Set(successRows.filter((row) => format(row.createdAt, "yyyy-MM-dd") === dayKey).map((row) => row.customerId ?? row.actorId)).size;
  const span = to.getTime() - from.getTime();
  const weekly = span >= 6 * 86400000 ? new Set(successRows.map((row) => row.customerId ?? row.actorId)).size : null;
  const monthly = span >= 29 * 86400000 ? weekly : null;
  return {
    total: auditCount,
    notes: [
      "Daily active users are distinct successful customer logins on the last day of the selected range.",
      "Weekly and monthly figures are shown only when the selected range is long enough. They are not estimated.",
    ],
    kpis: [
      { label: "Customer logins", value: logins, previous: null, format: "number" as const },
      { label: "Daily active users", value: daily, previous: null, format: "number" as const },
      { label: "Active in range", value: weekly, previous: null, format: "number" as const, note: weekly === null ? "Range is shorter than 7 days" : "Distinct successful logins" },
      { label: "Monthly active users", value: monthly, previous: null, format: "number" as const, note: monthly === null ? "Range is shorter than 30 days" : undefined },
      { label: "Failed logins", value: failed, previous: null, format: "number" as const },
    ],
    charts: {
      acquisition: bucket(successRows.map((row) => row.createdAt), "day"),
      split: [
        { label: "Successful", value: logins, color: "#2c7a4a" },
        { label: "Failed", value: failed, color: "#9b1c2a" },
      ],
      byMonth: [],
      plans: [],
    },
    tables: {
      audit: audit.map((row) => ({
        id: row.id,
        actor: row.actorEmail ?? row.actorType,
        role: row.adminRole,
        event: row.event,
        targetType: row.targetType,
        targetId: row.targetId,
        previousValue: row.previousValue,
        newValue: row.newValue,
        reason: row.reason,
        createdAt: row.createdAt,
        result: row.result,
      })),
    },
  };
}

