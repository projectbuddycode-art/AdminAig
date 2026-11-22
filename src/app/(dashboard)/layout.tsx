import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { activeAdmin } from "@/lib/current-admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await activeAdmin();
  if (!admin) redirect("/login");
  return (
    <AppShell adminName={admin.name} adminEmail={admin.email} role={admin.role} tenant={admin.tenant}>
      {children}
    </AppShell>
  );
}
