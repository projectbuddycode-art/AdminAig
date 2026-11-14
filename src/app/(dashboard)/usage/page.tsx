import { prisma } from "@/lib/db";
import { currentAdmin } from "@/lib/current-admin";
import { EmptyState, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const admin = await currentAdmin();
  const rows = await prisma.usageEntry.findMany({
    where: { tenant: admin.tenant },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true, machine: true },
  });
  const failed = await prisma.usageEntry.groupBy({
    by: ["customerId"],
    where: { tenant: admin.tenant, status: "FAILED" },
    _count: { _all: true },
  });
  const names = await prisma.customer.findMany({
    where: { id: { in: failed.map((row) => row.customerId) }, tenant: admin.tenant },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Usage and processing"
        description="Each successful export consumes one credit. Retries with the same idempotency key are not charged again."
      />
      {failed.length > 0 ? (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Customers with failed jobs:{" "}
          {failed
            .map((row) => `${names.find((n) => n.id === row.customerId)?.name ?? row.customerId} (${row._count._all})`)
            .join(", ")}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No usage yet" body="Processing and export events appear after they are recorded against a customer." />
      ) : (
        <TableWrap>
          <table className="app-table min-w-[880px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Customer</th>
                <th>Job</th>
                <th>Machine</th>
                <th>Status</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{format(row.createdAt, "dd MMM yyyy HH:mm")}</td>
                  <td>{row.customer.name}</td>
                  <td>{row.jobId}</td>
                  <td>{row.machine?.machineId ?? "—"}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{row.creditsConsumed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
