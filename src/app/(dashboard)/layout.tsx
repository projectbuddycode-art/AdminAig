import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { currentAdmin } from "@/lib/current-admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin().catch(() => null);
  if (!admin) redirect("/login");
  return (
    <AppShell adminName={admin.name} adminEmail={admin.email} role={admin.role} tenant={admin.tenant}>
      {children}
    </AppShell>
  );
}
