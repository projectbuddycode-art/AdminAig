import { currentAdmin } from "@/lib/current-admin";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const REPORTS = [
  ["customers", "Customer master"],
  ["usage", "Customer usage"],
  ["machines", "Machine allocation"],
  ["subscriptions", "Subscriptions"],
  ["renewals", "Upcoming renewals"],
  ["expired", "Expired memberships"],
  ["exports", "Export consumption"],
  ["failures", "Processing failures"],
  ["payments", "Payments"],
  ["audit", "Audit trail"],
  ["logins", "Login history"],
];

export default async function ReportsPage() {
  const admin = await currentAdmin();
  return (
    <>
      <PageHeader
        eyebrow="Exports"
        title="Reports"
        description={
          admin.tenant === "demo"
            ? "Downloads include only the demo tenant. Simulated payments are labelled."
            : "Downloads include only your tenant. Demo records are excluded."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map(([kind, label]) => (
          <Card key={kind}>
            <h2 className="font-semibold">{label}</h2>
            <a className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]" href={`/api/admin/reports?kind=${kind}`}>
              Download CSV
            </a>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        PDF is available by printing a CSV in a spreadsheet. Passwords, tokens and provider secrets are omitted.
      </p>
    </>
  );
}
