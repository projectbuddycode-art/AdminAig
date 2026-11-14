import { prisma } from "@/lib/db";
import { currentAdmin } from "@/lib/current-admin";
import { EmptyState, PageHeader, StatusBadge, TableWrap } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function LoginsPage() {
  const admin = await currentAdmin();
  const rows = await prisma.loginEvent.findMany({
    where: { tenant: admin.tenant },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader eyebrow="Security" title="Login history" description="Successful and failed sign-ins for administrators and customers in this tenant." />
      {rows.length === 0 ? (
        <EmptyState title="No login events" body="Sign-in attempts are stored when someone authenticates." />
      ) : (
        <TableWrap>
          <table className="app-table min-w-[720px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Email</th>
                <th>Result</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{format(row.createdAt, "dd MMM yyyy HH:mm:ss")}</td>
                  <td>{row.actorType}</td>
                  <td>{row.email}</td>
                  <td>
                    <StatusBadge value={row.success ? "SUCCESS" : "FAILED"} />
                  </td>
                  <td>{row.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
