import { prisma } from "@/lib/db";
import { currentAdmin } from "@/lib/current-admin";
import { EmptyState, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const admin = await currentAdmin();
  const rows = await prisma.notificationMessage.findMany({
    where: { tenant: admin.tenant },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true },
  });

  return (
    <>
      <PageHeader
        eyebrow="Communications"
        title="Notifications"
        description="Delivery status is recorded per message. Email and WhatsApp are not marked sent unless that provider is configured. Demo messages are simulated."
      />
      {rows.length === 0 ? (
        <EmptyState title="No messages" body="Queue a message from a customer profile. Duplicate idempotency keys are ignored." />
      ) : (
        <TableWrap>
          <table className="app-table min-w-[860px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Customer</th>
                <th>Template</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{format(row.createdAt, "dd MMM yyyy HH:mm")}</td>
                  <td>{row.customer?.name ?? "Group"}</td>
                  <td>{row.templateKey}</td>
                  <td>{row.channel}</td>
                  <td>
                    <StatusBadge value={row.simulated ? "SIMULATED" : row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
