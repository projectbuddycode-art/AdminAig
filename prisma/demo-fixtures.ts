import { addDays, addMinutes } from "date-fns";
import { decimalFromCents } from "../src/lib/money";

export const DEMO_TENANT = "demo";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const FEATURES = JSON.stringify({
  maxDevices: 2,
  monthlyExportLimit: 40,
  unlimitedExports: false,
  maxStorageMb: 8192,
  maxResolution: "hd",
  maxVideoMinutes: 45,
  premiumFeatures: false,
});

export const DEMO_PLANS = [
  { id: "demo_plan_studio", name: "DEMO Studio", durationDays: 30, priceCents: 490000 },
  { id: "demo_plan_atelier", name: "DEMO Atelier", durationDays: 90, priceCents: 1290000 },
  { id: "demo_plan_archive", name: "DEMO Archive", durationDays: 365, priceCents: 3990000 },
] as const;

export function demoMachineCode(index: number) {
  const segment = (seed: number) => {
    let value = seed;
    let out = "";
    for (let i = 0; i < 4; i += 1) {
      out += ALPHABET[value % ALPHABET.length];
      value = Math.floor(value / ALPHABET.length) + 1;
    }
    return out;
  };
  return `AIG-${segment(index * 17 + 3)}-${segment(index * 29 + 11)}`;
}

export function subscriptionKind(index: number): "ACTIVE" | "EXPIRED" | "SUSPENDED" | "TRIAL" {
  if (index % 11 === 0) return "SUSPENDED";
  if (index % 7 === 0) return "EXPIRED";
  if (index % 5 === 0) return "TRIAL";
  return "ACTIVE";
}

export function paymentKind(index: number): "PAID" | "PENDING" | "FAILED" | "REFUNDED" {
  if (index % 9 === 0) return "REFUNDED";
  if (index % 8 === 0) return "FAILED";
  if (index % 5 === 0) return "PENDING";
  return "PAID";
}

export function usageCountFor(index: number) {
  if (index === 1 || index === 2) return 16;
  if (index === 3) return 1;
  return 3;
}

function pad(index: number) {
  return String(index).padStart(2, "0");
}

export type DemoDataset = ReturnType<typeof buildDemoDataset>;

export function buildDemoDataset(now: Date) {
  const plans = DEMO_PLANS.map((plan) => ({
    ...plan,
    description: "DEMO DATA plan. Synthetic catalog price.",
    featuresJson: FEATURES,
    priceAmount: decimalFromCents(plan.priceCents),
    currency: "INR",
    tenant: DEMO_TENANT,
    status: "ACTIVE",
  }));

  const customers = Array.from({ length: 25 }, (_, offset) => {
    const index = offset + 1;
    const kind = subscriptionKind(index);
    const createdAt = addDays(now, -((index * 11) % 100) - 5);
    return {
      id: `demo_customer_${pad(index)}`,
      index,
      name: `Demo Customer ${pad(index)}`,
      email: `demo.customer.${pad(index)}@example.com`,
      phone: `90000${String(index).padStart(5, "0")}`,
      status: kind === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
      tenant: DEMO_TENANT,
      demoLabel: "DEMO DATA",
      source: "DEMO_SEED",
      emailVerified: index % 2 === 0,
      lastLoginAt: addDays(now, -(index % 20)),
      createdAt,
      company: index % 2 === 0 ? "Northwind Atelier" : "Harbor Studio",
      city: ["Pune", "Jaipur", "Kochi", "Indore"][index % 4],
      kind,
    };
  });

  const subscriptions = customers.map((customer) => {
    const plan = DEMO_PLANS[customer.index % DEMO_PLANS.length];
    const expiring = customer.kind === "ACTIVE" && customer.index % 6 === 1;
    const expiryDate =
      customer.kind === "EXPIRED"
        ? addDays(now, -3)
        : customer.kind === "TRIAL"
          ? addDays(now, 14)
          : expiring
            ? addDays(now, 4)
            : addDays(now, 40);
    const allowance = 40;
    const used = customer.index === 3 ? 0 : customer.index === 1 || customer.index === 2 ? 14 : customer.index % 8;
    return {
      id: `demo_sub_${pad(customer.index)}`,
      customerId: customer.id,
      planId: plan.id,
      status: customer.kind,
      startDate: customer.createdAt,
      expiryDate,
      renewalDate: expiryDate,
      exportAllowance: allowance,
      exportsUsed: used,
      creditsRemaining: Math.max(0, allowance - used),
      snapshotFeaturesJson: FEATURES,
      tenant: DEMO_TENANT,
      priceCents: plan.priceCents,
      priceAmount: decimalFromCents(plan.priceCents),
    };
  });

  const priorSubscriptions = [1, 6].map((index) => {
    const customer = customers[index - 1];
    const plan = DEMO_PLANS[0];
    return {
      id: `demo_sub_prior_${pad(index)}`,
      customerId: customer.id,
      planId: plan.id,
      status: "CANCELLED",
      startDate: addDays(customer.createdAt, -40),
      expiryDate: customer.createdAt,
      renewalDate: customer.createdAt,
      exportAllowance: 20,
      exportsUsed: 4,
      creditsRemaining: 16,
      snapshotFeaturesJson: FEATURES,
      tenant: DEMO_TENANT,
      priceCents: plan.priceCents,
      priceAmount: decimalFromCents(plan.priceCents),
      historyId: `demo_hist_prior_${pad(index)}`,
    };
  });

  const machineOwner = (machineIndex: number) => {
    if (machineIndex === 1 || machineIndex === 2) return customers[0];
    if (machineIndex === 3 || machineIndex === 4) return customers[1];
    if (machineIndex >= 5 && machineIndex <= 18) return customers[machineIndex - 3];
    return null;
  };

  const machines = Array.from({ length: 20 }, (_, offset) => {
    const index = offset + 1;
    const owner = machineOwner(index);
    return {
      id: `demo_machine_${pad(index)}`,
      machineId: demoMachineCode(index),
      customerId: owner?.id ?? null,
      status: owner ? "ASSIGNED" : "UNASSIGNED",
      firmwareVersion: index % 2 === 0 ? "1.4.2" : "1.3.9",
      model: "DiamondCam",
      serialNumber: `DEMO-SN-${pad(index)}`,
      hardwareRevision: "D",
      healthStatus: index === 4 || index === 12 ? "ATTENTION" : "OK",
      tenant: DEMO_TENANT,
      demoLabel: "DEMO DATA",
      telemetryVerified: false,
      telemetrySimulated: true,
      lastSeenAt: index === 1 ? addMinutes(now, -5) : addDays(now, -2),
      createdAt: addDays(now, -((index * 9) % 90) - 2),
    };
  });

  const assignments = machines
    .filter((machine) => machine.customerId)
    .map((machine, position) => ({
      id: `demo_assign_${pad(position + 1)}`,
      machineId: machine.id,
      customerId: machine.customerId as string,
      tenant: DEMO_TENANT,
      assignedAt: machine.createdAt,
      status: "ACTIVE",
    }));

  const usage = customers.flatMap((customer) => {
    const count = usageCountFor(customer.index);
    const machine = machines.find((row) => row.customerId === customer.id) ?? null;
    return Array.from({ length: count }, (_, offset) => {
      const sequence = offset + 1;
      const failed = customer.index === 8 || sequence % 4 === 0;
      const startedAt = addDays(customer.createdAt, Math.min(sequence, 20));
      const key = `demo:usage:${pad(customer.index)}:${pad(sequence)}`;
      return {
        id: `demo_usage_${pad(customer.index)}_${pad(sequence)}`,
        tenant: DEMO_TENANT,
        customerId: customer.id,
        machineId: machine?.id ?? null,
        jobId: `demo-job-${pad(customer.index)}-${pad(sequence)}`,
        idempotencyKey: key,
        sessionKey: `demo:session:${pad(customer.index)}`,
        jobKey: key,
        status: failed ? "FAILED" : "SUCCESS",
        startedAt,
        completedAt: addMinutes(startedAt, 8),
        durationMs: 12000 + sequence * 500,
        creditsConsumed: failed ? 0 : 1,
        storageMb: 80 + sequence,
        charged: !failed,
        failureReason: failed ? "DEMO DATA sample processing failure" : null,
        outputRef: failed ? null : `demo-output-${pad(customer.index)}-${pad(sequence)}`,
        exportId: `demo_export_${pad(customer.index)}_${pad(sequence)}`,
        jobRowId: `demo_job_${pad(customer.index)}_${pad(sequence)}`,
      };
    });
  });

  const sessions = customers.map((customer) => ({
    id: `demo_session_${pad(customer.index)}`,
    tenant: DEMO_TENANT,
    customerId: customer.id,
    machineId: machines.find((row) => row.customerId === customer.id)?.id ?? null,
    sessionKey: `demo:session:${pad(customer.index)}`,
    status: customer.index === 8 ? "FAILED" : "COMPLETE",
    startedAt: customer.createdAt,
    endedAt: addDays(customer.createdAt, 1),
    storageMb: 240 + customer.index,
  }));

  const payments = customers.map((customer) => {
    const subscription = subscriptions[customer.index - 1];
    const status = paymentKind(customer.index);
    return {
      id: `demo_payment_${pad(customer.index)}`,
      tenant: DEMO_TENANT,
      customerId: customer.id,
      subscriptionId: subscription.id,
      amountCents: subscription.priceCents,
      amount: subscription.priceAmount,
      currency: "INR",
      status,
      method: "SIMULATED",
      reference: `DEMO-PAY-${pad(customer.index)}`,
      invoiceNumber: `DEMO-INV-${pad(customer.index)}`,
      simulated: true,
      demoLabel: "DEMO DATA",
      paidAt: status === "PAID" || status === "REFUNDED" ? customer.createdAt : null,
      createdAt: customer.createdAt,
    };
  });

  const refunds = payments
    .filter((payment) => payment.status === "REFUNDED")
    .map((payment) => ({
      id: `demo_refund_${payment.id.slice(-2)}`,
      tenant: DEMO_TENANT,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      amount: payment.amount,
      currency: "INR",
      status: "SIMULATED",
      reason: "DEMO DATA simulated refund",
      simulated: true,
      createdAt: addDays(payment.createdAt, 2),
    }));

  const logins = customers.flatMap((customer) => [
    {
      id: `demo_login_${pad(customer.index)}_ok`,
      tenant: DEMO_TENANT,
      actorType: "CUSTOMER",
      actorId: customer.id,
      email: customer.email,
      success: true,
      method: "PASSWORD",
      customerId: customer.id,
      createdAt: customer.lastLoginAt,
    },
    {
      id: `demo_login_${pad(customer.index)}_no`,
      tenant: DEMO_TENANT,
      actorType: "CUSTOMER",
      actorId: customer.id,
      email: customer.email,
      success: false,
      method: "PASSWORD",
      customerId: customer.id,
      createdAt: addDays(customer.lastLoginAt, -1),
    },
  ]);

  const audits = customers.map((customer) => ({
    id: `demo_audit_${pad(customer.index)}`,
    event: "CUSTOMER_CREATED",
    actorType: "SYSTEM",
    actorEmail: "demo-seed@example.com",
    adminRole: "SYSTEM",
    targetType: "CUSTOMER",
    targetId: customer.id,
    customerId: customer.id,
    tenant: DEMO_TENANT,
    reason: "DEMO DATA seed",
    newValue: JSON.stringify({ label: "DEMO DATA", email: customer.email }),
    result: "SUCCESS",
    createdAt: customer.createdAt,
  }));

  const notifications = customers.map((customer) => ({
    id: `demo_notice_${pad(customer.index)}`,
    tenant: DEMO_TENANT,
    customerId: customer.id,
    channel: "EMAIL",
    templateKey: "renewal",
    subject: "DEMO DATA renewal reminder",
    body: "Simulated reminder. No message was delivered.",
    status: "SIMULATED",
    simulated: true,
    idempotencyKey: `demo:notice:${pad(customer.index)}`,
    createdAt: addDays(now, -((customer.index * 3) % 21)),
    sentAt: addDays(now, -((customer.index * 3) % 21)),
  }));

  const ticketIndexes = [1, 4, 8, 12, 16, 20, 24, 25];
  const tickets = ticketIndexes.map((index, position) => ({
    id: `demo_ticket_${pad(index)}`,
    tenant: DEMO_TENANT,
    customerId: `demo_customer_${pad(index)}`,
    subject: "DEMO DATA support request",
    status: position % 3 === 0 ? "OPEN" : "ANSWERED",
    priority: index === 8 ? "HIGH" : "NORMAL",
    createdAt: addDays(now, -index),
    body: "Synthetic ticket. No customer was contacted.",
  }));

  const errors = [4, 8, 12, 16, 19, 20].map((index) => ({
    id: `demo_error_${pad(index)}`,
    machineId: `demo_machine_${pad(index)}`,
    tenant: DEMO_TENANT,
    code: index === 4 ? "MOTOR_STALL" : "SENSOR_DRIFT",
    message: "DEMO DATA sample machine error",
    createdAt: addDays(now, -index),
  }));

  return {
    plans,
    customers,
    subscriptions,
    priorSubscriptions,
    machines,
    assignments,
    usage,
    sessions,
    payments,
    refunds,
    logins,
    audits,
    notifications,
    tickets,
    errors,
    integrations: [
      { id: "demo_integration_email", provider: "EMAIL", status: "DISABLED" },
      { id: "demo_integration_whatsapp", provider: "WHATSAPP", status: "DISABLED" },
    ],
  };
}

export function demoDatasetCounts(now = new Date()) {
  const data = buildDemoDataset(now);
  return {
    customers: data.customers.length,
    machines: data.machines.length,
    plans: data.plans.length,
    subscriptions: data.subscriptions.length + data.priorSubscriptions.length,
    usage: data.usage.length,
    payments: data.payments.length,
    refunds: data.refunds.length,
    logins: data.logins.length,
    audits: data.audits.length,
    notifications: data.notifications.length,
    tickets: data.tickets.length,
    errors: data.errors.length,
  };
}
