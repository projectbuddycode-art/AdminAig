import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { activeAdmin } from "@/lib/current-admin";

export const dynamic = "force-dynamic";

function sampleDatabaseEnabled() {
  const flag = process.env.USE_SAMPLE_DB?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await activeAdmin();
  if (!admin) redirect("/login");
  return (
    <AppShell adminName={admin.name} adminEmail={admin.email} role={admin.role} tenant={admin.tenant}>
      {sampleDatabaseEnabled() ? (
        <div className="mb-4 rounded-[var(--radius)] border border-[#e6d6a8] bg-[#fff8e8] px-4 py-3 text-sm text-[#6a5520]">
          Sample demo data is loaded in memory. PostgreSQL is not required for this walkthrough.
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
