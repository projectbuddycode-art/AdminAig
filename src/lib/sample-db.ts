import { addDays, addMinutes } from "date-fns";
import type { PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const MANY: Record<string, Record<string, { table: string; key: string }>> = {
  customer: {
    subscriptions: { table: "subscription", key: "customerId" },
    machines: { table: "machine", key: "customerId" },
    assignments: { table: "assignment", key: "customerId" },
    payments: { table: "payment", key: "customerId" },
    usageEntries: { table: "usageEntry", key: "customerId" },
  },
  plan: { subscriptions: { table: "subscription", key: "planId" } },
  machine: {
    assignments: { table: "assignment", key: "machineId" },
    errors: { table: "machineError", key: "machineId" },
    maintenance: { table: "maintenanceRecord", key: "machineId" },
    usageEntries: { table: "usageEntry", key: "machineId" },
  },
  subscription: { payments: { table: "payment", key: "subscriptionId" } },
};

const ONE: Record<string, Record<string, { table: string; key: string; local?: string }>> = {
  subscription: {
    plan: { table: "plan", key: "id", local: "planId" },
    customer: { table: "customer", key: "id", local: "customerId" },
  },
  machine: { customer: { table: "customer", key: "id", local: "customerId" } },
  assignment: {
    machine: { table: "machine", key: "id", local: "machineId" },
    customer: { table: "customer", key: "id", local: "customerId" },
  },
  payment: {
    customer: { table: "customer", key: "id", local: "customerId" },
    subscription: { table: "subscription", key: "id", local: "subscriptionId" },
  },
  usageEntry: {
    customer: { table: "customer", key: "id", local: "customerId" },
    machine: { table: "machine", key: "id", local: "machineId" },
  },
  loginEvent: { customer: { table: "customer", key: "id", local: "customerId" } },
  notificationMessage: { customer: { table: "customer", key: "id", local: "customerId" } },
  customer: { profile: { table: "profile", key: "customerId", local: "id" } },
};

const FIELD_OPS = new Set(["contains", "in", "not", "gte", "lte", "lt", "gt", "equals", "startsWith", "endsWith", "mode"]);

function time(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return Date.parse(value);
  return null;
}

function same(left: unknown, right: unknown) {
  const leftTime = time(left);
  const rightTime = time(right);
  if (leftTime != null && rightTime != null) return leftTime === rightTime;
  return left === right;
}

function compareOp(value: unknown, expected: Record<string, unknown>) {
  if ("equals" in expected && !same(value, expected.equals)) return false;
  if ("in" in expected && !((expected.in as unknown[]) ?? []).some((item) => same(item, value))) return false;
  if ("not" in expected) {
    if (expected.not === null) {
      if (value == null) return false;
    } else if (same(value, expected.not)) return false;
  }
  const text = String(value ?? "");
  const needle = String(expected.contains ?? expected.startsWith ?? expected.endsWith ?? "");
  const haystack = expected.mode === "insensitive" ? text.toLowerCase() : text;
  const probe = expected.mode === "insensitive" ? needle.toLowerCase() : needle;
  if ("contains" in expected && !haystack.includes(probe)) return false;
  if ("startsWith" in expected && !haystack.startsWith(probe)) return false;
  if ("endsWith" in expected && !haystack.endsWith(probe)) return false;
  const valueTime = time(value);
  const asNumber = valueTime ?? (typeof value === "number" ? value : null);
  for (const op of ["gte", "lte", "lt", "gt"] as const) {
    if (!(op in expected) || asNumber == null) continue;
    const bound = time(expected[op]) ?? Number(expected[op]);
    if (op === "gte" && asNumber < bound) return false;
    if (op === "lte" && asNumber > bound) return false;
    if (op === "gt" && asNumber <= bound) return false;
    if (op === "lt" && asNumber >= bound) return false;
  }
  return true;
}

function isFieldOp(value: unknown) {
  if (!value || typeof value !== "object" || value instanceof Date || Array.isArray(value)) return false;
  const keys = Object.keys(value as object);
  return keys.length > 0 && keys.every((key) => FIELD_OPS.has(key));
}

function relatedRows(store: Record<string, Row[]>, table: string, relation: string, row: Row) {
  const many = MANY[table]?.[relation];
  if (many) return store[many.table].filter((item) => item[many.key] === row.id);
  const one = ONE[table]?.[relation];
  if (!one) return [];
  const local = one.local ?? "id";
  return store[one.table].filter((item) => item[one.key] === row[local]);
}

function matches(store: Record<string, Row[]>, table: string, row: Row, where?: Where): boolean {
  if (!where) return true;
  if (Array.isArray(where.AND) && !where.AND.every((item) => matches(store, table, row, item as Where))) return false;
  if (Array.isArray(where.OR) && !where.OR.some((item) => matches(store, table, row, item as Where))) return false;
  if (where.NOT && matches(store, table, row, where.NOT as Where)) return false;
  for (const [key, expected] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") continue;
    if (MANY[table]?.[key] || ONE[table]?.[key]) {
      const related = relatedRows(store, table, key, row);
      const filter = expected as Where;
      if (filter?.some) {
        if (!related.some((item) => matches(store, MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table, item, filter.some as Where))) return false;
      } else if (filter?.none) {
        if (related.some((item) => matches(store, MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table, item, filter.none as Where))) return false;
      } else if (expected && typeof expected === "object") {
        const target = MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table;
        if (!related.some((item) => matches(store, target, item, expected as Where))) return false;
      }
      continue;
    }
    if (expected === null) {
      if (row[key] != null) return false;
      continue;
    }
    if (isFieldOp(expected)) {
      if (!compareOp(row[key], expected as Record<string, unknown>)) return false;
      continue;
    }
    if (!same(row[key], expected)) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy?: Record<string, "asc" | "desc">) {
  if (!orderBy) return rows;
  const [key, direction] = Object.entries(orderBy)[0] ?? [];
  if (!key) return rows;
  return [...rows].sort((left, right) => {
    const leftTime = time(left[key]);
    const rightTime = time(right[key]);
    const delta = leftTime != null && rightTime != null ? leftTime - rightTime : String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
    return direction === "desc" ? -delta : delta;
  });
}

function shape(store: Record<string, Row[]>, table: string, row: Row, args?: { include?: Where; select?: Where }) {
  const copy: Row = { ...row };
  const include = args?.include ?? {};
  for (const [key, spec] of Object.entries(include)) {
    if (key === "_count") {
      const select = (spec as { select?: Record<string, boolean> }).select ?? {};
      copy._count = Object.fromEntries(Object.keys(select).map((relation) => [relation, relatedRows(store, table, relation, row).length]));
      continue;
    }
    const options = (spec === true ? {} : spec) as { where?: Where; orderBy?: Record<string, "asc" | "desc">; take?: number; include?: Where; select?: Where };
    let related = relatedRows(store, table, key, row).filter((item) => matches(store, MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table, item, options.where));
    related = sortRows(related, options.orderBy);
    if (options.take) related = related.slice(0, options.take);
    const target = MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table;
    const shaped = related.map((item) => shape(store, target, item, { include: options.include, select: options.select }));
    copy[key] = MANY[table]?.[key] ? shaped : shaped[0] ?? null;
  }
  if (!args?.select) return copy;
  const selected: Row = {};
  for (const [key, spec] of Object.entries(args.select)) {
    if (spec === true) selected[key] = copy[key];
    else if (spec && typeof spec === "object") {
      const target = MANY[table]?.[key]?.table ?? ONE[table]?.[key]?.table ?? table;
      const options = spec as {
        where?: Where;
        orderBy?: Record<string, "asc" | "desc">;
        take?: number;
        include?: Where;
        select?: Where;
      };
      let nested = relatedRows(store, table, key, row).filter((item) => matches(store, target, item, options.where));
      nested = sortRows(nested, options.orderBy);
      if (options.take) nested = nested.slice(0, options.take);
      const nestedShaped = nested.map((item) =>
        shape(store, target, item, {
          include: options.include,
          select: options.select,
        }),
      );
      selected[key] = MANY[table]?.[key] ? nestedShaped : nestedShaped[0] ?? null;
    }
  }
  return selected;
}

function buildStore() {
  const now = new Date();
  const plans = [
    { id: "sample_plan_studio", name: "Studio", description: "Sample catalog plan.", durationDays: 30, priceCents: 490000, priceAmount: "4900.00", currency: "INR", featuresJson: "{}", tenant: "production", status: "ACTIVE", deletedAt: null, createdAt: addDays(now, -90) },
    { id: "sample_plan_atelier", name: "Atelier", description: "Sample catalog plan.", durationDays: 90, priceCents: 1290000, priceAmount: "12900.00", currency: "INR", featuresJson: "{}", tenant: "production", status: "ACTIVE", deletedAt: null, createdAt: addDays(now, -90) },
    { id: "sample_plan_archive", name: "Archive", description: "Sample catalog plan.", durationDays: 365, priceCents: 3990000, priceAmount: "39900.00", currency: "INR", featuresJson: "{}", tenant: "production", status: "ACTIVE", deletedAt: null, createdAt: addDays(now, -90) },
  ];
  const accounts = [
    ["01", "Meera Shah", "meera.shah@example.com", "9820011101", "ACTIVE", "ACTIVE", 5, 18, 1, 0],
    ["02", "Arjun Patel", "arjun.patel@example.com", "9820011102", "ACTIVE", "ACTIVE", 48, 40, 2, 1],
    ["03", "Kavya Nair", "kavya.nair@example.com", "9820011103", "ACTIVE", "ACTIVE", 200, 70, 4, 2],
    ["04", "Rohan Iyer", "rohan.iyer@example.com", "9820011104", "ACTIVE", "TRIAL", 12, 6, 1, 0],
    ["05", "Leela Kapoor", "leela.kapoor@example.com", "9820011105", "SUSPENDED", "SUSPENDED", 20, 55, 21, 1],
    ["06", "Dev Malhotra", "dev.malhotra@example.com", "9820011106", "ACTIVE", "EXPIRED", -4, 80, 12, 0],
    ["07", "Anika Bose", "anika.bose@example.com", "9820011107", "ACTIVE", "ACTIVE", 90, 3, 0, 2],
    ["08", "Vikram Desai", "vikram.desai@example.com", "9820011108", "ACTIVE", "ACTIVE", 22, 27, 8, 0],
  ] as const;
  const customers = accounts.map((account) => ({
    id: `sample_customer_${account[0]}`,
    name: account[1],
    email: account[2],
    phone: account[3],
    passwordHash: "sample",
    status: account[4],
    tenant: "production",
    demoLabel: null,
    emailVerified: true,
    loginMethod: "PASSWORD",
    source: "SAMPLE",
    lastLoginAt: addDays(now, -account[8]),
    passwordChangedAt: null,
    complimentaryCredits: 0,
    deletedAt: null,
    createdAt: addDays(now, -account[7]),
    updatedAt: now,
  }));
  const subscriptions = accounts.map((account) => {
    const plan = plans[account[9]];
    const used = account[0] === "01" ? 28 : 8;
    return {
      id: `sample_sub_${account[0]}`,
      customerId: `sample_customer_${account[0]}`,
      planId: plan.id,
      status: account[5],
      startDate: addDays(now, -account[7]),
      expiryDate: addDays(now, account[6]),
      renewalDate: addDays(now, account[6]),
      exportAllowance: 40,
      exportsUsed: used,
      creditsRemaining: Math.max(0, 40 - used),
      snapshotFeaturesJson: "{}",
      tenant: "production",
      createdAt: addDays(now, -account[7]),
      updatedAt: now,
    };
  });
  const machineIds = ["AIG-H3KL-P9RT", "AIG-M2NP-Q8VW", "AIG-B4DF-H7JK", "AIG-N5PQ-R3TV", "AIG-W6XY-Z2CD", "AIG-C8EF-F4GH", "AIG-J9KM-N2PQ", "AIG-R5TV-W8XY", "AIG-D3FG-H6JK", "AIG-L7MN-P4RS"];
  const machinePlan = [
    { n: "01", customer: "01", status: "ASSIGNED", health: "HEALTHY", minutes: 2, verified: true },
    { n: "02", customer: "01", status: "ASSIGNED", health: "HEALTHY", minutes: 4, verified: true },
    { n: "03", customer: "02", status: "ASSIGNED", health: "HEALTHY", minutes: 60 * 24 * 2, verified: true },
    { n: "04", customer: "03", status: "ASSIGNED", health: "HEALTHY", minutes: 8, verified: true },
    { n: "05", customer: "04", status: "ASSIGNED", health: "UNKNOWN", minutes: 60 * 24 * 6, verified: false },
    { n: "06", customer: "05", status: "SUSPENDED", health: "ATTENTION", minutes: 60 * 24 * 9, verified: true },
    { n: "07", customer: "07", status: "ASSIGNED", health: "HEALTHY", minutes: 60 * 30, verified: true },
    { n: "08", customer: "08", status: "ASSIGNED", health: "HEALTHY", minutes: 60 * 24 * 4, verified: true },
    { n: "09", customer: null, status: "UNASSIGNED", health: "UNKNOWN", minutes: null, verified: false },
    { n: "10", customer: null, status: "UNASSIGNED", health: "UNKNOWN", minutes: null, verified: false },
  ];
  const machines = machinePlan.map((machine, index) => ({
    id: `sample_machine_${machine.n}`,
    machineId: machineIds[index],
    customerId: machine.customer ? `sample_customer_${machine.customer}` : null,
    status: machine.status,
    firmwareVersion: "2.4.1",
    model: "DiamondCam",
    serialNumber: `DC-2026-${machine.n}`,
    hardwareRevision: "C",
    healthStatus: machine.health,
    motorConfig: "{}",
    lightingConfig: "{}",
    lastSeenAt: machine.minutes == null ? null : addMinutes(now, -machine.minutes),
    telemetryVerified: machine.verified,
    telemetrySimulated: false,
    tenant: "production",
    demoLabel: null,
    deletedAt: null,
    createdAt: addDays(now, -20),
    updatedAt: now,
  }));
  const assignments = machinePlan.flatMap((machine) =>
    machine.customer
      ? [{
          id: `sample_assignment_${machine.n}`,
          machineId: `sample_machine_${machine.n}`,
          customerId: `sample_customer_${machine.customer}`,
          tenant: "production",
          assignedAt: addDays(now, -15),
          unassignedAt: machine.status === "SUSPENDED" ? addDays(now, -3) : null,
          status: machine.status === "SUSPENDED" ? "ENDED" : "ACTIVE",
        }]
      : [],
  );
  const payments = accounts.map((account) => {
    const plan = plans[account[9]];
    const status = account[0] === "05" ? "FAILED" : account[0] === "06" ? "REFUNDED" : account[0] === "04" ? "PENDING" : "PAID";
    return {
      id: `sample_payment_${account[0]}`,
      tenant: "production",
      customerId: `sample_customer_${account[0]}`,
      subscriptionId: `sample_sub_${account[0]}`,
      amountCents: plan.priceCents,
      amount: plan.priceAmount,
      currency: "INR",
      status,
      method: "UPI",
      reference: `SAMPLE-INV-${account[0]}`,
      invoiceNumber: `INV-2026-${account[0]}`,
      simulated: false,
      demoLabel: null,
      paidAt: status === "PAID" || status === "REFUNDED" ? addDays(now, -account[7] + 1) : null,
      createdAt: addDays(now, -Math.min(account[7], 27)),
    };
  });
  const usage = accounts.flatMap((account) =>
    Array.from({ length: 8 }, (_, day) => {
      const when = addDays(now, -((Number(account[0]) * 3 + day * 4) % 28));
      const failed = day === 7;
      const machine = machinePlan.find((item) => item.customer === account[0]);
      return {
        id: `sample_usage_${account[0]}_${day}`,
        tenant: "production",
        customerId: `sample_customer_${account[0]}`,
        machineId: machine ? `sample_machine_${machine.n}` : null,
        processingJobId: null,
        jobId: `sample-job-${account[0]}-${day}`,
        idempotencyKey: `sample:usage:${account[0]}:${day}`,
        sourceRecording: failed ? null : `recording-${account[0]}-${day}`,
        preset: "studio-spin",
        status: failed ? "FAILED" : "SUCCESS",
        startedAt: when,
        completedAt: addMinutes(when, 6),
        durationMs: failed ? 4000 : 12000 + day * 3000,
        creditsConsumed: failed ? 0 : 1,
        storageMb: failed ? 0 : 80 + day * 12,
        exportDate: failed ? null : when,
        outputRef: failed ? null : `export-${account[0]}-${day}`,
        failureReason: failed ? "Sample processing failure" : null,
        charged: !failed,
        createdAt: when,
      };
    }),
  );
  const logins = accounts.map((account) => ({
    id: `sample_login_${account[0]}`,
    tenant: "production",
    actorType: "CUSTOMER",
    actorId: `sample_customer_${account[0]}`,
    email: account[2],
    success: account[0] !== "05",
    method: "PASSWORD",
    ipAddress: null,
    userAgent: null,
    sessionId: null,
    customerId: `sample_customer_${account[0]}`,
    createdAt: addDays(now, -account[8]),
  }));
  const activity = accounts.map((account) => ({
    id: `sample_activity_${account[0]}`,
    event: "CUSTOMER_CREATED",
    actorType: "ADMIN",
    actorId: "sample_admin",
    actorEmail: "admin@aig.local",
    adminRole: "SUPER_ADMIN",
    targetType: "CUSTOMER",
    targetId: `sample_customer_${account[0]}`,
    customerId: `sample_customer_${account[0]}`,
    machineRef: null,
    metadata: "{}",
    previousValue: null,
    newValue: null,
    reason: null,
    result: "SUCCESS",
    ipAddress: null,
    userAgent: null,
    tenant: "production",
    createdAt: addDays(now, -account[7]),
  }));
  return {
    admin: [{ id: "sample_admin", name: "AIG Administrator", email: "admin@aig.local", passwordHash: "sample", role: "SUPER_ADMIN", status: "ACTIVE", tenant: "production", lastLoginAt: now, deletedAt: null, createdAt: addDays(now, -1) }],
    customer: customers,
    profile: accounts.map((account) => ({ id: `sample_profile_${account[0]}`, customerId: `sample_customer_${account[0]}`, company: account[1], city: "Sample", notes: "Sample account", deletedAt: null, createdAt: now, updatedAt: now })),
    plan: plans,
    subscription: subscriptions,
    machine: machines,
    assignment: assignments,
    payment: payments,
    usageEntry: usage,
    loginEvent: logins,
    activityLog: activity,
    notificationMessage: [{ id: "sample_notice_01", tenant: "production", customerId: "sample_customer_01", channel: "IN_APP", templateKey: "renewal", subject: "Studio plan expires in 5 days", body: "Sample renewal reminder for Meera Shah.", status: "RECORDED", simulated: false, error: null, idempotencyKey: "sample:notice:01", createdAt: addDays(now, -1), sentAt: null }],
    machineError: [{ id: "sample_error_06", machineId: "sample_machine_06", tenant: "production", code: "MOTOR_STALL", message: "Turntable motor stalled during the last capture.", createdAt: addDays(now, -3) }],
    maintenanceRecord: [],
  } as Record<string, Row[]>;
}

const globalStore = globalThis as unknown as { aigSampleStore?: Record<string, Row[]> };

function store() {
  if (!globalStore.aigSampleStore) globalStore.aigSampleStore = buildStore();
  return globalStore.aigSampleStore;
}

function model(name: string) {
  const table = store()[name] ? name : name;
  return {
    async findMany(args?: { where?: Where; orderBy?: Record<string, "asc" | "desc">; skip?: number; take?: number; include?: Where; select?: Where }) {
      let rows = store()[table].filter((row) => matches(store(), table, row, args?.where));
      rows = sortRows(rows, args?.orderBy);
      if (args?.skip) rows = rows.slice(args.skip);
      if (args?.take) rows = rows.slice(0, args.take);
      return rows.map((row) => shape(store(), table, row, args));
    },
    async findUnique(args: { where: Where; include?: Where; select?: Where }) {
      const row = store()[table].find((item) => matches(store(), table, item, args.where));
      return row ? shape(store(), table, row, args) : null;
    },
    async findFirst(args?: { where?: Where; include?: Where; orderBy?: Record<string, "asc" | "desc">; select?: Where }) {
      const [row] = sortRows(store()[table].filter((item) => matches(store(), table, item, args?.where)), args?.orderBy);
      return row ? shape(store(), table, row, args) : null;
    },
    async count(args?: { where?: Where }) {
      return store()[table].filter((row) => matches(store(), table, row, args?.where)).length;
    },
    async create(args: { data: Row }) {
      const row = { id: `sample_${table}_${store()[table].length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store()[table].push(row);
      return row;
    },
    async update(args: { where: Where; data: Row; include?: Where }) {
      const row = store()[table].find((item) => matches(store(), table, item, args.where));
      if (!row) return null;
      Object.assign(row, args.data, { updatedAt: new Date() });
      return shape(store(), table, row, args);
    },
    async updateMany(args: { where?: Where; data: Row }) {
      const rows = store()[table].filter((row) => matches(store(), table, row, args.where));
      for (const row of rows) Object.assign(row, args.data);
      return { count: rows.length };
    },
    async deleteMany(args?: { where?: Where }) {
      const kept = store()[table].filter((row) => !matches(store(), table, row, args?.where));
      const count = store()[table].length - kept.length;
      store()[table] = kept;
      return { count };
    },
    async aggregate(args: { where?: Where; _sum?: Record<string, boolean> }) {
      const rows = store()[table].filter((row) => matches(store(), table, row, args.where));
      const sums: Record<string, number> = {};
      for (const key of Object.keys(args._sum ?? {})) {
        sums[key] = rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
      }
      return { _sum: sums, _count: { _all: rows.length } };
    },
    async groupBy(args: { by: string[]; where?: Where; _count?: { _all?: boolean } }) {
      const rows = store()[table].filter((row) => matches(store(), table, row, args.where));
      const groups = new Map<string, { keys: Row; count: number }>();
      for (const row of rows) {
        const keys = Object.fromEntries(args.by.map((key) => [key, row[key]]));
        const id = JSON.stringify(keys);
        const current = groups.get(id) ?? { keys, count: 0 };
        current.count += 1;
        groups.set(id, current);
      }
      return [...groups.values()].map((group) => ({ ...group.keys, _count: { _all: group.count } }));
    },
  };
}

export function createSampleClient() {
  const client = {
    admin: model("admin"),
    customer: model("customer"),
    customerProfile: model("profile"),
    plan: model("plan"),
    subscription: model("subscription"),
    machine: model("machine"),
    machineAssignment: model("assignment"),
    payment: model("payment"),
    usageEntry: model("usageEntry"),
    loginEvent: model("loginEvent"),
    activityLog: model("activityLog"),
    notificationMessage: model("notificationMessage"),
    machineError: model("machineError"),
    maintenanceRecord: model("maintenanceRecord"),
    async $queryRaw() {
      return [{ ok: 1 }];
    },
    async $transaction(input: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) {
      if (typeof input === "function") return input(client);
      return Promise.all(input);
    },
    async $disconnect() {
      return undefined;
    },
  };
  return client as unknown as PrismaClient;
}
