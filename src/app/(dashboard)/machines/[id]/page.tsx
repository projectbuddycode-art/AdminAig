import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getMachineDetail } from "@/server/queries";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmSubmit } from "@/components/forms";
import { activateMachineAction, recordMaintenanceAction, suspendMachineAction, unassignMachineAction } from "@/server/actions";
import { asFormAction } from "@/lib/form-action";
import { AssignMachineForm } from "@/components/machine-forms";
import { currentAdmin } from "@/lib/current-admin";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await currentAdmin();
  const detail = await getMachineDetail(prisma, id, admin.tenant);
  if (!detail) notFound();
  const customers = await prisma.customer.findMany({
    where: { status: "ACTIVE", tenant: admin.tenant },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const { machine, display } = detail;

  return (
    <>
      <PageHeader
        eyebrow="Machine"
        title={machine.machineId}
        description="Permanent business identity. Not an IP address and not derived from a customer email."
        actions={
          <form action={asFormAction(machine.status === "SUSPENDED" ? activateMachineAction.bind(null, machine.id) : suspendMachineAction.bind(null, machine.id))}>
            <ConfirmSubmit
              label={machine.status === "SUSPENDED" ? "Reactivate machine" : "Suspend machine"}
              confirmLabel={machine.status === "SUSPENDED" ? "Reactivate this machine?" : "Suspend this machine?"}
              tone={machine.status === "SUSPENDED" ? "neutral" : "danger"}
            />
          </form>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Account status</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Display status</dt>
              <dd>
                <StatusBadge value={display.display} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Account</dt>
              <dd>{display.account}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Entitlement</dt>
              <dd>{display.entitlement}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Firmware</dt>
              <dd>{machine.firmwareVersion ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Model</dt>
              <dd>{machine.model}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Serial</dt>
              <dd>{machine.serialNumber ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Hardware</dt>
              <dd>{machine.hardwareRevision ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Health</dt>
              <dd>{machine.healthStatus}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--muted)]">Connectivity</dt>
              <dd>
                {display.connectivity}. {display.connectivityNote}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Last seen</dt>
              <dd>{machine.lastSeenAt ? format(machine.lastSeenAt, "dd MMM yyyy HH:mm") : "No cloud heartbeat recorded"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Created</dt>
              <dd>{format(machine.createdAt, "dd MMM yyyy")}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Customer</dt>
              <dd>{machine.customer?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd>{detail.subscription?.planName ?? "—"}</dd>
            </div>
          </dl>
          {machine.customerId ? (
            <form action={asFormAction(unassignMachineAction.bind(null, machine.id))} className="mt-5">
              <ConfirmSubmit label="Unassign" confirmLabel="Unassign this machine?" tone="neutral" />
            </form>
          ) : null}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Assign / reassign</h2>
          <AssignMachineForm machineDbId={machine.id} customers={customers} />
        </Card>
      </div>
      <Card className="mt-5">
        <h2 className="mb-4 font-semibold">Assignment history</h2>
        {detail.assignments.length === 0 ? (
          <EmptyState title="No history" body="This machine has never been assigned." />
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.assignments.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>
                  {row.customer.name} · {format(row.assignedAt, "dd MMM yyyy")}
                  {row.unassignedAt ? ` – ${format(row.unassignedAt, "dd MMM yyyy")}` : ""}
                </span>
                <StatusBadge value={row.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Configuration</h2>
          <p className="text-sm">Motor: {machine.motorConfig}</p>
          <p className="mt-2 text-sm">Lighting: {machine.lightingConfig}</p>
          <p className="mt-2 text-xs text-[var(--muted)]">Wi-Fi passwords and hardware secrets are not stored in this view.</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Maintenance</h2>
          <form action={asFormAction(recordMaintenanceAction)} className="flex flex-col gap-2">
            <input type="hidden" name="machineDbId" value={machine.id} />
            <input name="note" required minLength={3} placeholder="Maintenance note" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <ConfirmSubmit label="Record maintenance" confirmLabel="Save this maintenance note?" tone="neutral" />
          </form>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.maintenance.map((row) => (
              <li key={row.id}>
                {format(row.createdAt, "dd MMM yyyy")} · {row.note}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-5">
        <h2 className="mb-3 font-semibold">Errors and processing</h2>
        {detail.errors.length === 0 && detail.usage.length === 0 ? (
          <EmptyState title="No machine errors" body="Error logs and processing jobs appear when they are recorded." />
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.errors.map((row) => (
              <li key={row.id}>
                {row.code}: {row.message}
              </li>
            ))}
            {detail.usage.map((row) => (
              <li key={row.id}>
                Job {row.jobId} · {row.status}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="mt-5">
        <h2 className="mb-4 font-semibold">Activity</h2>
        {detail.activity.length === 0 ? (
          <EmptyState title="No activity" body="Machine events will appear here." />
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <span>{item.event.replaceAll("_", " ")}</span>
                <span className="text-[var(--muted)]">{format(item.createdAt, "dd MMM yyyy HH:mm")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
