import Link from "next/link";
import { format } from "date-fns";
import type { Admin } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatChange, percentChange, REPORT_PRESETS, resolveReportRange } from "@/lib/report-range";
import { getAnalytics, type ReportSection } from "@/server/analytics";
import { BarChart, Donut, LineChart } from "@/components/report-charts";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

const SECTIONS: { id: ReportSection; label: string; permission?: "payments.view" }[] = [
  { id: "overview", label: "Overview" },
  { id: "customers", label: "Customers" },
  { id: "machines", label: "Machines" },
  { id: "usage", label: "Usage" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "finance", label: "Finance", permission: "payments.view" },
  { id: "activity", label: "Activity" },
];

function money(cents: number) {
  return `INR ${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function showValue(value: number | null, kind: "number" | "money" | "percent") {
  if (value === null) return "—";
  if (kind === "money") return money(value);
  if (kind === "percent") return `${value}%`;
  return value.toLocaleString("en-IN");
}

export async function ReportBody({
  admin,
  raw,
  print = false,
}: {
  admin: Admin;
  raw: Record<string, string | string[] | undefined>;
  print?: boolean;
}) {
  const read = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const requested = read("section") as ReportSection;
  const allowed = SECTIONS.filter((section) => !section.permission || can(admin.role, section.permission));
  const section = allowed.some((item) => item.id === requested) ? requested : "overview";
  const range = resolveReportRange({ preset: read("preset") || "30d", from: read("from"), to: read("to") });
  const page = Math.max(1, Number(read("page") || 1));
  const filters = {
    tenant: admin.tenant,
    range,
    customerId: read("customerId") || undefined,
    machineId: read("machineId") || undefined,
    planId: read("planId") || undefined,
    status: read("status") || undefined,
    q: read("q") || undefined,
    page,
    pageSize: 8,
    adminEmail: read("admin") || undefined,
    action: read("action") || undefined,
  };
  const [report, plans, customers, machines] = await Promise.all([
    section === "finance" && !can(admin.role, "payments.view")
      ? null
      : getAnalytics(prisma, section, filters),
    prisma.plan.findMany({ where: { tenant: admin.tenant }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: { tenant: admin.tenant },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.machine.findMany({
      where: { tenant: admin.tenant },
      select: { id: true, machineId: true },
      orderBy: { machineId: "asc" },
      take: 200,
    }),
  ]);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value && key !== "page") params.set(key, value);
  }
  params.set("section", section);
  const href = (nextPage: number) => {
    const copy = new URLSearchParams(params);
    copy.set("page", String(nextPage));
    return `${print ? "/reports/print" : "/reports"}?${copy.toString()}`;
  };
  const exportHref = `/api/admin/reports?kind=${section}&from=${range.from.toISOString()}&to=${range.to.toISOString()}`;

  return (
    <div className="analytics">
      <PageHeader
        eyebrow={admin.tenant === "demo" ? "Demo data" : "Live tenant"}
        title="Reports and analytics"
        description={`${range.label}. Figures are aggregated for this tenant only. Updated ${format(report?.generatedAt ?? new Date(), "dd MMM yyyy HH:mm")}.`}
        actions={
          print ? (
            <PrintButton />
          ) : (
            <>
              <a className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold" href={exportHref}>
                Download CSV
              </a>
              <Link className="rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white" href={`/reports/print?${params.toString()}`}>
                Open PDF view
              </Link>
            </>
          )
        }
      />
      <form className="mb-4 grid gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-white p-3 md:grid-cols-4" method="get">
        <input type="hidden" name="section" value={section} />
        <select name="preset" defaultValue={range.preset} aria-label="Date range" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          {REPORT_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset === "7d" ? "Last 7 days" : preset === "30d" ? "Last 30 days" : preset === "90d" ? "Last 90 days" : preset === "month" ? "This month" : preset === "lastMonth" ? "Last month" : preset === "year" ? "This year" : preset[0].toUpperCase() + preset.slice(1)}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={read("from")} aria-label="From" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <input name="to" type="date" defaultValue={read("to")} aria-label="To" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <select name="customerId" defaultValue={read("customerId")} aria-label="Customer" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <select name="machineId" defaultValue={read("machineId")} aria-label="Machine" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          <option value="">All machines</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.machineId}
            </option>
          ))}
        </select>
        <select name="planId" defaultValue={read("planId")} aria-label="Plan" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          <option value="">All plans</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={read("status")} aria-label="Status" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
        <input name="admin" defaultValue={read("admin")} placeholder="Administrator" aria-label="Administrator" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <input name="action" defaultValue={read("action")} placeholder="Action type" aria-label="Action type" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <input name="q" defaultValue={read("q")} placeholder="Search" aria-label="Search" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <button className="rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white" type="submit">
          Apply
        </button>
      </form>
      <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Report sections">
        {allowed.map((item) => (
          <Link
            key={item.id}
            href={`/reports?${new URLSearchParams({ ...Object.fromEntries(params.entries()), section: item.id, page: "1" }).toString()}`}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${item.id === section ? "bg-[#1e3a5f] font-semibold text-white" : "border border-[var(--border)] bg-white"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {!report ? (
        <EmptyState title="Finance reports are restricted" body="Your role cannot view payment amounts." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {report.kpis.map((kpi) => (
              <Card key={kpi.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{kpi.label}</p>
                <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl">{showValue(kpi.value, kpi.format)}</p>
                <p className={`mt-1 text-xs ${kpi.previous !== null && kpi.value !== null && kpi.value >= kpi.previous ? "text-[#2c7a4a]" : "text-[var(--muted)]"}`}>
                  {kpi.format === "percent" ? "Shown only when a prior cohort exists" : formatChange(kpi.value !== null && kpi.previous !== null ? percentChange(kpi.value, kpi.previous) : null)}
                </p>
                {"note" in kpi && kpi.note ? <p className="mt-1 text-xs text-[var(--muted)]">{kpi.note}</p> : null}
              </Card>
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Trend</h2>
              <LineChart points={report.charts.acquisition} label="Trend" />
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Distribution</h2>
              <Donut slices={report.charts.split} label="Distribution" />
            </Card>
            {report.charts.byMonth.length > 0 ? (
              <Card>
                <h2 className="mb-2 text-sm font-semibold">Breakdown</h2>
                <BarChart points={report.charts.byMonth} label="Breakdown" />
              </Card>
            ) : null}
            {report.charts.plans.length > 0 ? (
              <Card>
                <h2 className="mb-2 text-sm font-semibold">Composition</h2>
                <Donut slices={report.charts.plans} label="Composition" />
              </Card>
            ) : null}
          </div>
          <div className="mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
            {report.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
          <ReportTable section={section} tables={report.tables as Record<string, unknown>} />
          <Pagination page={page} pageSize={8} total={report.total} href={href} />
        </>
      )}
    </div>
  );
}

function ReportTable({ section, tables }: { section: ReportSection; tables: Record<string, unknown> }) {
  if (section === "machines" && Array.isArray(tables.machines)) {
    const rows = tables.machines as Array<Record<string, unknown>>;
    if (rows.length === 0) return <EmptyState title="No machines" body="No machines match these filters." />;
    return (
      <Card className="mt-4 overflow-x-auto">
        <table className="app-table min-w-[880px]">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Customer</th>
              <th>Model</th>
              <th>Firmware</th>
              <th>Last communication</th>
              <th>Status</th>
              <th>Sessions</th>
              <th>Failed</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  <Link href={`/machines/${row.id}`} className="font-semibold text-[#1e3a5f]">
                    {String(row.machineId)}
                  </Link>
                  {row.demoLabel ? <div className="text-[10px]">DEMO DATA</div> : null}
                </td>
                <td>{row.customerId ? <Link href={`/customers/${row.customerId}`}>{String(row.customer)}</Link> : String(row.customer)}</td>
                <td>{String(row.model)}</td>
                <td>{String(row.firmwareVersion ?? "—")}</td>
                <td>{row.lastSeenAt ? format(new Date(String(row.lastSeenAt)), "dd MMM HH:mm") : "None recorded"}</td>
                <td>{String(row.connectivity)}</td>
                <td>{String(row.totalSessions)}</td>
                <td>{String(row.failed)}</td>
                <td>{String(row.errors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (section === "usage" && Array.isArray(tables.ranked)) {
    const rows = tables.ranked as Array<Record<string, unknown>>;
    if (rows.length === 0) return <EmptyState title="No usage" body="The usage ledger has no jobs in this range." />;
    return (
      <Card className="mt-4 overflow-x-auto">
        <table className="app-table min-w-[760px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>Allowed</th>
              <th>Consumed</th>
              <th>Remaining</th>
              <th>Utilization</th>
              <th>Exports in range</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  <Link href={`/customers/${row.id}`} className="font-semibold text-[#1e3a5f]">
                    {String(row.name)}
                  </Link>
                </td>
                <td>{String(row.plan)}</td>
                <td>{String(row.allowed)}</td>
                <td>{String(row.consumed)}</td>
                <td>{String(row.remaining)}</td>
                <td>{row.utilization === null ? "Unlimited or unset" : `${row.utilization}%`}</td>
                <td>{String(row.exports)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if ((section === "subscriptions") && Array.isArray(tables.subscriptions)) {
    const rows = tables.subscriptions as Array<Record<string, unknown>>;
    if (rows.length === 0) return <EmptyState title="No subscriptions" body="No subscriptions were created in this range." />;
    return (
      <Card className="mt-4 overflow-x-auto">
        <table className="app-table min-w-[760px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Start</th>
              <th>Expiry</th>
              <th>Catalog price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id}-${row.startDate}`}>
                <td>
                  <Link href={`/customers/${row.id}`} className="font-semibold text-[#1e3a5f]">
                    {String(row.customer)}
                  </Link>
                </td>
                <td>{String(row.plan)}</td>
                <td>{String(row.status)}</td>
                <td>{format(new Date(String(row.startDate)), "dd MMM yyyy")}</td>
                <td>{format(new Date(String(row.expiryDate)), "dd MMM yyyy")}</td>
                <td>{money(Number(row.priceCents))} catalog</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (section === "finance" && Array.isArray(tables.payments)) {
    const rows = tables.payments as Array<Record<string, unknown>>;
    if (rows.length === 0) return <EmptyState title="No payments" body="No payment records exist in this range." />;
    return (
      <Card className="mt-4 overflow-x-auto">
        <table className="app-table min-w-[720px]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.reference)}>
                <td>
                  <Link href={`/customers/${row.id}`} className="font-semibold text-[#1e3a5f]">
                    {String(row.customer)}
                  </Link>
                </td>
                <td>{money(Number(row.amountCents))}</td>
                <td>{String(row.status)}</td>
                <td>{String(row.reference)}</td>
                <td>{format(new Date(String(row.createdAt)), "dd MMM yyyy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  if (section === "activity" && Array.isArray(tables.audit)) {
    const rows = tables.audit as Array<Record<string, unknown>>;
    if (rows.length === 0) return <EmptyState title="No activity" body="No audit events match this range." />;
    return (
      <Card className="mt-4 overflow-x-auto">
        <table className="app-table min-w-[960px]">
          <thead>
            <tr>
              <th>When</th>
              <th>Administrator</th>
              <th>Role</th>
              <th>Action</th>
              <th>Before</th>
              <th>After</th>
              <th>Reason</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{format(new Date(String(row.createdAt)), "dd MMM HH:mm")}</td>
                <td>{String(row.actor)}</td>
                <td>{String(row.role ?? "—")}</td>
                <td>{String(row.event)}</td>
                <td className="max-w-[10rem] truncate">{String(row.previousValue ?? "—")}</td>
                <td className="max-w-[10rem] truncate">{String(row.newValue ?? "—")}</td>
                <td>{String(row.reason ?? "—")}</td>
                <td>{String(row.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }
  const latest = Array.isArray(tables.latest) ? (tables.latest as Array<Record<string, unknown>>) : [];
  if (latest.length === 0) return <EmptyState title="No registrations in this range" body="Customers created before the selected dates stay in the totals and are omitted from this list." />;
  return (
    <Card className="mt-4 overflow-x-auto">
      <table className="app-table min-w-[640px]">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Email</th>
            <th>Status</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {latest.map((row) => (
            <tr key={String(row.id)}>
              <td>
                <Link href={`/customers/${row.id}`} className="font-semibold text-[#1e3a5f]">
                  {String(row.name)}
                </Link>
                {row.demoLabel ? <div className="text-[10px]">DEMO DATA</div> : null}
              </td>
              <td>{String(row.email)}</td>
              <td>{String(row.status)}</td>
              <td>{format(new Date(String(row.createdAt)), "dd MMM yyyy")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
