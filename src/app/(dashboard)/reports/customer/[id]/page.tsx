import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { currentAdmin } from "@/lib/current-admin";
import { REPORT_PRESETS, resolveReportRange } from "@/lib/report-range";
import { getCustomerReport } from "@/server/analytics";
import { AreaTrend, BarChart, Donut, DualTrend } from "@/components/report-charts";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `INR ${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function showValue(value: number | null, kind: "number" | "money" | "percent") {
  if (value === null) return "—";
  if (kind === "money") return money(value);
  if (kind === "percent") return `${value}%`;
  return value.toLocaleString("en-IN");
}

export default async function CustomerReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw, admin] = await Promise.all([params, searchParams, currentAdmin()]);
  const read = (key: string) => (typeof raw[key] === "string" ? raw[key] : "");
  const range = resolveReportRange({ preset: read("preset") || "30d", from: read("from"), to: read("to") });
  const report = await getCustomerReport(prisma, id, admin.tenant, range);
  if (!report) notFound();

  const query = new URLSearchParams();
  if (read("preset")) query.set("preset", read("preset"));
  if (read("from")) query.set("from", read("from"));
  if (read("to")) query.set("to", read("to"));
  const qs = query.toString();

  return (
    <div className="analytics">
      <PageHeader
        eyebrow="Individual customer report"
        title={report.customer.name}
        description={`${report.customer.email} · ${range.label} · Updated ${format(report.generatedAt, "dd MMM yyyy HH:mm")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/customers/${report.customer.id}`} className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold">
              Customer profile
            </Link>
            <Link
              href={`/reports?section=usage&customerId=${report.customer.id}${qs ? `&${qs}` : `&preset=${range.preset}`}`}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold"
            >
              Filtered usage
            </Link>
            <Link href="/reports" className="rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white">
              All reports
            </Link>
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-white p-3" method="get">
        <select name="preset" defaultValue={range.preset} aria-label="Date range" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm">
          {REPORT_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset === "7d"
                ? "Last 7 days"
                : preset === "30d"
                  ? "Last 30 days"
                  : preset === "90d"
                    ? "Last 90 days"
                    : preset === "month"
                      ? "This month"
                      : preset === "lastMonth"
                        ? "Last month"
                        : preset === "year"
                          ? "This year"
                          : preset[0].toUpperCase() + preset.slice(1)}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={read("from")} aria-label="From" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <input name="to" type="date" defaultValue={read("to")} aria-label="To" className="rounded-md border border-[var(--border)] px-2 py-2 text-sm" />
        <button className="rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white" type="submit">
          Apply range
        </button>
      </form>

      <div className="mb-4 grid gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-white to-[#eef3f9] p-4 md:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Status</p>
          <div className="mt-1">
            <StatusBadge value={report.customer.status} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Plan</p>
          <p className="mt-1 text-sm font-semibold">
            {report.customer.plan ?? "No plan"} {report.customer.planStatus ? `· ${report.customer.planStatus}` : ""}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Exports</p>
          <p className="mt-1 text-sm font-semibold">
            {report.customer.exportsUsed} used · {report.customer.creditsRemaining} remaining of {report.customer.exportAllowance}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Last login</p>
          <p className="mt-1 text-sm font-semibold">
            {report.customer.lastLoginAt ? format(report.customer.lastLoginAt, "dd MMM yyyy HH:mm") : "Never"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {report.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{kpi.label}</p>
            <p className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[#1e3a5f]">{showValue(kpi.value, kpi.format)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Usage and credits</h2>
            <p className="text-xs text-[var(--muted)]">Jobs and credits consumed in this range</p>
          </div>
          <DualTrend primary={report.charts.jobs} secondary={report.charts.credits} primaryLabel="Jobs" secondaryLabel="Credits" />
        </Card>
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Job outcomes</h2>
            <p className="text-xs text-[var(--muted)]">Successful vs failed processing jobs</p>
          </div>
          <Donut slices={report.charts.outcomes} label="Job outcomes" />
        </Card>
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Duration profile</h2>
            <p className="text-xs text-[var(--muted)]">How long processing jobs ran</p>
          </div>
          <BarChart points={report.charts.durations.map((slice) => ({ label: slice.label, value: slice.value }))} label="Durations" />
        </Card>
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Collected payments</h2>
            <p className="text-xs text-[var(--muted)]">Verified PAID amounts for this customer</p>
          </div>
          <AreaTrend points={report.charts.revenue} label="Revenue" color="#2c7a4a" />
        </Card>
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Login activity</h2>
            <p className="text-xs text-[var(--muted)]">Successful customer logins</p>
          </div>
          <AreaTrend points={report.charts.logins} label="Logins" color="#3d6f9a" />
        </Card>
        <Card>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e3a5f]">Assigned machines</h2>
            <p className="text-xs text-[var(--muted)]">Hardware currently linked to this account</p>
          </div>
          {report.customer.machines.length === 0 ? (
            <EmptyState title="No machines" body="No machines are assigned to this customer." />
          ) : (
            <ul className="space-y-2 text-sm">
              {report.customer.machines.map((machine) => (
                <li key={machine.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div>
                    <Link href={`/machines/${machine.id}`} className="font-semibold text-[#1e3a5f]">
                      {machine.machineId}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {machine.model} · {machine.status}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {machine.lastSeenAt ? format(machine.lastSeenAt, "dd MMM HH:mm") : "No heartbeat"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-[#1e3a5f]">Payments in range</h2>
          {report.tables.payments.length === 0 ? (
            <EmptyState title="No payments" body="No payment records for this customer in the selected range." />
          ) : (
            <table className="app-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {report.tables.payments.map((row) => (
                  <tr key={String(row.reference)}>
                    <td>{money(Number(row.amountCents))}</td>
                    <td>{String(row.status)}</td>
                    <td>{String(row.reference)}</td>
                    <td>{format(new Date(String(row.createdAt)), "dd MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-[#1e3a5f]">Recent admin activity</h2>
          {report.tables.audit.length === 0 ? (
            <EmptyState title="No activity" body="No audit events for this customer in the selected range." />
          ) : (
            <table className="app-table min-w-[520px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {report.tables.audit.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{format(new Date(String(row.createdAt)), "dd MMM HH:mm")}</td>
                    <td>{String(row.event)}</td>
                    <td>{String(row.actor)}</td>
                    <td>{String(row.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
