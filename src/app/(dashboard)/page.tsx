import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDashboardMetrics } from "@/server/queries";
import { ButtonLink, Card, EmptyState, KpiCard, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { currentAdmin } from "@/lib/current-admin";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const admin = await currentAdmin();
  const metrics = await getDashboardMetrics(prisma, admin.tenant);
  const kpis = [
    { label: "Total Customers", value: metrics.totalCustomers, description: "Registered customer accounts" },
    { label: "Active Customers", value: metrics.activeCustomers, description: "Accounts not currently suspended" },
    { label: "Total Machines", value: metrics.totalMachines, description: "Machines registered in the system" },
    { label: "Unassigned Machines", value: metrics.unassignedMachines, description: "Available for customer assignment" },
    { label: "Active Subscriptions", value: metrics.activeSubscriptions, description: "Entitlements currently in force" },
    { label: "Expiring in 7 days", value: metrics.expiringSubscriptions, description: "Active plans approaching expiry" },
    { label: "New this month", value: metrics.newMonth, description: "Customers registered since the first of the month" },
    { label: "Suspended customers", value: metrics.suspendedCustomers, description: "Accounts currently suspended" },
    { label: "Inactive customers", value: metrics.inactiveCustomers, description: "Active accounts with no login in 30 days" },
    { label: "Online machines", value: metrics.onlineMachines, description: "Verified, non-simulated heartbeat within 15 minutes" },
    { label: "Offline machines", value: metrics.offlineMachines, description: "Last heartbeat older than 15 minutes" },
    { label: "Needs attention", value: metrics.attentionMachines, description: "Suspended or flagged health status" },
    { label: "Expired memberships", value: metrics.expiredSubscriptions, description: "Subscriptions marked expired" },
    { label: "Processing jobs", value: metrics.usageTotal, description: "Usage ledger rows in this tenant" },
    { label: "Successful jobs", value: metrics.usageSuccess, description: "Completed processing that consumed a credit once" },
    { label: "Failed jobs", value: metrics.usageFailed, description: "Processing failures, not charged" },
    { label: "Exports this month", value: metrics.exportMonth, description: "Successful exports since the first of the month" },
    { label: "Collected (INR)", value: Math.round(metrics.collectedCents / 100), description: "Non-simulated paid amounts" },
    { label: "Pending (INR)", value: Math.round(metrics.pendingCents / 100), description: "Non-simulated pending amounts" },
  ];

  return (
    <>
      <PageHeader
        title="Command center"
        description={
          admin.tenant === "demo"
            ? "Demonstration tenant. Figures are synthetic DEMO DATA and are excluded from production reports."
            : "Live figures from this tenant. Online machines require a verified heartbeat in the last 15 minutes."
        }
      />

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-0 sm:p-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <SectionTitle title="Recent activity" />
            <ButtonLink href="/activity" variant="ghost">
              View all activity
            </ButtonLink>
          </div>
          {metrics.recentActivity.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState title="No recent activity" body="Events appear here when customers, machines, plans or subscriptions change." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-table min-w-[640px] px-4">
                <thead>
                  <tr>
                    <th className="pl-4">Event</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Time</th>
                    <th className="pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentActivity.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <td className="pl-4 font-medium">{item.event.replaceAll("_", " ")}</td>
                      <td className="text-[var(--text-secondary)]">{item.actorEmail ?? item.actorType}</td>
                      <td>{item.targetType}</td>
                      <td className="whitespace-nowrap text-[var(--muted)]">{format(item.createdAt, "dd MMM HH:mm")}</td>
                      <td className="pr-4">
                        <StatusBadge value={item.actorType} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Machine overview" />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Total</dt>
              <dd className="text-lg font-semibold">{metrics.totalMachines}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Assigned</dt>
              <dd className="text-lg font-semibold">{metrics.activeMachines}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Unassigned</dt>
              <dd className="text-lg font-semibold">{metrics.unassignedMachines}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Suspended</dt>
              <dd className="text-lg font-semibold">{metrics.suspendedMachines}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
            Online status is shown only after a verified heartbeat. Simulated demo heartbeats are counted separately and are not treated as live machines.
            Collected revenue excludes simulated payment rows.
          </p>
          <Link href="/machines" className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]">
            Open machines
          </Link>
        </Card>
      </div>
    </>
  );
}
