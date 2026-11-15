import { NextResponse } from "next/server";
import { idIn, idsBetween } from "@/server/dated-rows";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function csv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!can(admin.role, "reports.export") && !can(admin.role, "audit.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("kind") ?? "customers";
  const kind = requested === "overview" ? "customers" : requested === "finance" ? "payments" : requested === "activity" ? "audit" : requested;
  if ((kind === "finance" || kind === "payments") && !can(admin.role, "payments.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenant = admin.tenant;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const dated = async (table: "Customer" | "Subscription" | "UsageEntry" | "Payment" | "ActivityLog" | "LoginEvent") =>
    from || to ? { id: idIn(await idsBetween(prisma, table, from ? new Date(from) : new Date(0), to ? new Date(to) : new Date(), tenant)) } : {};
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  let rows: string[][] = [["empty"]];

  if (kind === "customers") {
    const data = await prisma.customer.findMany({ where: { tenant, deletedAt: null, ...(await dated("Customer")) }, orderBy: { createdAt: "desc" } });
    rows = [["id", "name", "email", "phone", "status", "createdAt", "lastLoginAt", "tenant"], ...data.map((row) => [row.id, row.name, row.email, row.phone, row.status, row.createdAt.toISOString(), row.lastLoginAt?.toISOString() ?? "", row.tenant])];
  } else if (kind === "machines") {
    const data = await prisma.machine.findMany({ where: { tenant, deletedAt: null }, include: { customer: true } });
    rows = [["machineId", "status", "customer", "firmware", "connectivity"], ...data.map((row) => [row.machineId, row.status, row.customer?.email ?? "", row.firmwareVersion ?? "", row.telemetryVerified && !row.telemetrySimulated ? "verified-heartbeat" : "not-live"])];
  } else if (kind === "subscriptions" || kind === "renewals" || kind === "expired") {
    const data = await prisma.subscription.findMany({
      where: {
        tenant,
        ...(await dated("Subscription")),
        ...(kind === "renewals" ? { status: "ACTIVE", expiryDate: { gt: now, lte: soon } } : {}),
        ...(kind === "expired" ? { status: "EXPIRED" } : {}),
      },
      include: { customer: true, plan: true },
    });
    rows = [["customer", "plan", "status", "expiry", "allowance", "used"], ...data.map((row) => [row.customer.email, row.plan.name, row.status, row.expiryDate.toISOString(), String(row.exportAllowance), String(row.exportsUsed)])];
  } else if (kind === "usage" || kind === "exports" || kind === "failures") {
    const data = await prisma.usageEntry.findMany({
      where: { tenant, ...(await dated("UsageEntry")), ...(kind === "exports" ? { status: "SUCCESS" } : {}), ...(kind === "failures" ? { status: "FAILED" } : {}) },
      include: { customer: true },
    });
    rows = [["customer", "job", "status", "credits", "when"], ...data.map((row) => [row.customer.email, row.jobId, row.status, String(row.creditsConsumed), row.createdAt.toISOString()])];
  } else if (kind === "payments") {
    const data = await prisma.payment.findMany({ where: { tenant, ...(await dated("Payment")) }, include: { customer: true } });
    rows = [["customer", "amountCents", "status", "simulated", "reference"], ...data.map((row) => [row.customer.email, String(row.amountCents), row.status, row.simulated ? "SIMULATED" : "RECORDED", row.reference])];
  } else if (kind === "audit") {
    const data = await prisma.activityLog.findMany({ where: { tenant, ...(await dated("ActivityLog")) }, orderBy: { createdAt: "desc" }, take: 2000 });
    rows = [["when", "event", "actor", "role", "reason", "before", "after", "result"], ...data.map((row) => [row.createdAt.toISOString(), row.event, row.actorEmail ?? "", row.adminRole ?? "", row.reason ?? "", row.previousValue ?? "", row.newValue ?? "", row.result])];
  } else if (kind === "logins") {
    const data = await prisma.loginEvent.findMany({ where: { tenant, ...(await dated("LoginEvent")) }, orderBy: { createdAt: "desc" }, take: 2000 });
    rows = [["when", "actor", "email", "success", "method"], ...data.map((row) => [row.createdAt.toISOString(), row.actorType, row.email, row.success ? "yes" : "no", row.method])];
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${tenant}.csv"`,
    },
  });
}
