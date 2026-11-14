import { currentAdmin } from "@/lib/current-admin";
import { Card, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const INTEGRATIONS = [
  {
    name: "Email",
    provider: "Resend",
    configured: () => Boolean(process.env.RESEND_API_KEY),
    note: "Set RESEND_API_KEY to send transactional email. The key is never shown here.",
  },
  {
    name: "WhatsApp",
    provider: "WhatsApp Cloud API",
    configured: () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
    note: "Not connected in this codebase. Requires a WhatsApp Business token and phone number id.",
  },
  {
    name: "Payments",
    provider: "None installed",
    configured: () => false,
    note: "No payment provider is integrated. Manual reconciliation can be recorded by finance roles. Amounts are not collected automatically.",
  },
  {
    name: "Machine telemetry",
    provider: "Customer API heartbeat",
    configured: () => true,
    note: "POST /api/v1/machines/heartbeat with a customer token records a verified heartbeat. Old timestamps are not treated as online.",
  },
];

export default async function IntegrationsPage() {
  await currentAdmin();
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Integration center"
        description="Connection state is derived from server configuration. A missing credential is shown as not configured."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((item) => {
          const on = item.configured();
          return (
            <Card key={item.name}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{item.name}</h2>
                <StatusBadge value={on ? "CONFIGURED" : "NOT_CONFIGURED"} />
              </div>
              <p className="mt-2 text-sm">{item.provider}</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{item.note}</p>
              <p className="mt-3 text-xs text-[var(--muted)]">Last successful sync: not recorded. Last error: none stored.</p>
            </Card>
          );
        })}
      </div>
    </>
  );
}
