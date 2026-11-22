import { addDays, subDays } from "date-fns";

const now = new Date();

export const offlineBanner =
  "Offline demo mode. PostgreSQL is not reachable, so the dashboard is showing sample figures for the client walkthrough.";

export function offlineDashboardMetrics() {
  return {
    totalCustomers: 8,
    activeCustomers: 7,
    suspendedCustomers: 1,
    inactiveCustomers: 1,
    newToday: 0,
    newWeek: 2,
    newMonth: 3,
    recentLogins: 4,
    totalMachines: 6,
    activeMachines: 4,
    unassignedMachines: 2,
    suspendedMachines: 0,
    onlineMachines: 0,
    offlineMachines: 3,
    attentionMachines: 1,
    activeSubscriptions: 5,
    expiringSubscriptions: 1,
    expiredSubscriptions: 1,
    suspendedSubscriptions: 1,
    usageTotal: 24,
    usageSuccess: 20,
    usageFailed: 4,
    exportMonth: 12,
    collectedCents: 2480000,
    monthlyCollectedCents: 490000,
    pendingCents: 129000,
    failedPayments: 1,
    refundCents: 0,
    recentActivity: [
      {
        id: "offline_act_1",
        event: "CUSTOMER_CREATED",
        actorType: "ADMIN",
        actorEmail: "admin@aig.local",
        targetType: "CUSTOMER",
        createdAt: subDays(now, 1),
      },
      {
        id: "offline_act_2",
        event: "MACHINE_ASSIGNED",
        actorType: "ADMIN",
        actorEmail: "admin@aig.local",
        targetType: "MACHINE",
        createdAt: subDays(now, 2),
      },
      {
        id: "offline_act_3",
        event: "SUBSCRIPTION_CHANGED",
        actorType: "ADMIN",
        actorEmail: "admin@aig.local",
        targetType: "SUBSCRIPTION",
        createdAt: subDays(now, 3),
      },
    ],
  };
}

export function offlineCustomers() {
  const rows = [
    { id: "offline_c_01", name: "Meera Shah", email: "meera.shah@example.com", phone: "9820011101", status: "ACTIVE", plan: "Studio", createdAt: subDays(now, 18) },
    { id: "offline_c_02", name: "Arjun Patel", email: "arjun.patel@example.com", phone: "9820011102", status: "ACTIVE", plan: "Atelier", createdAt: subDays(now, 40) },
    { id: "offline_c_03", name: "Kavya Nair", email: "kavya.nair@example.com", phone: "9820011103", status: "ACTIVE", plan: "Archive", createdAt: subDays(now, 70) },
    { id: "offline_c_04", name: "Rohan Iyer", email: "rohan.iyer@example.com", phone: "9820011104", status: "ACTIVE", plan: "Studio", createdAt: subDays(now, 6) },
    { id: "offline_c_05", name: "Leela Kapoor", email: "leela.kapoor@example.com", phone: "9820011105", status: "SUSPENDED", plan: "Atelier", createdAt: subDays(now, 55) },
    { id: "offline_c_06", name: "Dev Malhotra", email: "dev.malhotra@example.com", phone: "9820011106", status: "ACTIVE", plan: "Studio", createdAt: subDays(now, 80) },
    { id: "offline_c_07", name: "Anika Bose", email: "anika.bose@example.com", phone: "9820011107", status: "ACTIVE", plan: "Archive", createdAt: subDays(now, 3) },
    { id: "offline_c_08", name: "Vikram Desai", email: "vikram.desai@example.com", phone: "9820011108", status: "ACTIVE", plan: "Studio", createdAt: subDays(now, 27) },
  ];
  return {
    total: rows.length,
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.createdAt,
      demoLabel: "DEMO DATA",
      tenant: "production",
      subscriptions: [{ plan: { name: row.plan }, status: row.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE", expiryDate: addDays(now, 30) }],
      machines: [],
    })),
  };
}

export function offlinePlans() {
  return [
    { id: "offline_plan_studio", name: "Studio", durationDays: 30, priceCents: 490000, status: "ACTIVE", tenant: "production" },
    { id: "offline_plan_atelier", name: "Atelier", durationDays: 90, priceCents: 1290000, status: "ACTIVE", tenant: "production" },
    { id: "offline_plan_archive", name: "Archive", durationDays: 365, priceCents: 3990000, status: "ACTIVE", tenant: "production" },
  ];
}

export function offlineSubscriptions() {
  return offlineCustomers().rows.map((row, index) => ({
    id: `offline_sub_${index + 1}`,
    status: row.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    startDate: subDays(now, 20),
    expiryDate: addDays(now, 30),
    customer: { id: row.id, name: row.name, email: row.email },
    plan: { id: "offline_plan_studio", name: row.subscriptions[0]?.plan.name ?? "Studio", priceCents: 490000 },
  }));
}

export function offlineActivity() {
  return offlineDashboardMetrics().recentActivity.map((row) => ({
    ...row,
    actorId: "open-access-admin",
    targetId: "offline",
    result: "SUCCESS",
    reason: null,
    previousValue: null,
    newValue: null,
  }));
}

export function offlineMachines() {
  const rows = [
    { id: "offline_m_01", machineId: "AIG-SAMPLE-01", status: "ASSIGNED", customer: "Meera Shah", model: "DiamondCam" },
    { id: "offline_m_02", machineId: "AIG-SAMPLE-02", status: "ASSIGNED", customer: "Arjun Patel", model: "DiamondCam" },
    { id: "offline_m_03", machineId: "AIG-SAMPLE-03", status: "ASSIGNED", customer: "Kavya Nair", model: "DiamondCam" },
    { id: "offline_m_04", machineId: "AIG-SAMPLE-04", status: "ASSIGNED", customer: "Rohan Iyer", model: "DiamondCam" },
    { id: "offline_m_05", machineId: "AIG-SAMPLE-05", status: "UNASSIGNED", customer: null, model: "DiamondCam" },
    { id: "offline_m_06", machineId: "AIG-SAMPLE-06", status: "UNASSIGNED", customer: null, model: "DiamondCam" },
  ];
  return {
    total: rows.length,
    rows: rows.map((row) => ({
      id: row.id,
      machineId: row.machineId,
      status: row.status,
      model: row.model,
      serialNumber: null,
      firmwareVersion: "1.0.0",
      lastSeenAt: null,
      telemetryVerified: false,
      telemetrySimulated: false,
      healthStatus: "UNKNOWN",
      demoLabel: "DEMO DATA",
      customer: row.customer ? { id: "offline", name: row.customer, email: "" } : null,
      display: {
        accountStatus: row.status,
        entitlement: row.status === "ASSIGNED" ? "Active" : "Unassigned",
        connectivity: "No heartbeat recorded",
        connectivityNote: "Offline demo sample. Not a live device.",
      },
    })),
  };
}
