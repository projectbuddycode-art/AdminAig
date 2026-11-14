import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCustomerDetail, listActivePlans, listAssignableMachines } from "@/server/queries";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { ConfirmSubmit } from "@/components/forms";
import { activateCustomerAction, assignMachineAction, changePlanAction, extendMembershipAction, grantCreditsAction, queueNotificationAction, suspendCustomerAction, unassignMachineAction } from "@/server/actions";
import { asFormAction } from "@/lib/form-action";
import { EditCustomerForm } from "@/components/customer-forms";
import { currentAdmin } from "@/lib/current-admin";
import { format } from "date-fns";
import { LineChart } from "@/components/report-charts";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await currentAdmin();
  const detail = await getCustomerDetail(prisma, id, admin.tenant);
  if (!detail) notFound();
  const [plans, machines] = await Promise.all([
    listActivePlans(prisma, admin.tenant),
    listAssignableMachines(prisma, admin.tenant),
  ]);
  const { customer, currentSubscription } = detail;

  return (
    <>
      <PageHeader
        eyebrow="Customer"
        title={customer.name}
        description={customer.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={customer.status} />
            <form action={asFormAction(customer.status === "ACTIVE" ? suspendCustomerAction.bind(null, customer.id) : activateCustomerAction.bind(null, customer.id))}>
            <ConfirmSubmit
              label={customer.status === "ACTIVE" ? "Suspend customer" : "Reactivate customer"}
              confirmLabel={
                customer.status === "ACTIVE"
                  ? "Suspend this customer and pause active subscriptions?"
                  : "Reactivate this customer?"
              }
              tone={customer.status === "ACTIVE" ? "danger" : "neutral"}
            />
          </form>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Customer information</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Phone</dt>
              <dd>{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Status</dt>
              <dd>
                <StatusBadge value={customer.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Customer ID</dt>
              <dd className="truncate">{customer.id}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Created</dt>
              <dd>{format(customer.createdAt, "dd MMM yyyy HH:mm")}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Last login</dt>
              <dd>{customer.lastLoginAt ? format(customer.lastLoginAt, "dd MMM yyyy HH:mm") : "Never"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Login method</dt>
              <dd>{customer.loginMethod}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Source</dt>
              <dd>{customer.source}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Verified</dt>
              <dd>{customer.emailVerified ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Updated</dt>
              <dd>{format(customer.updatedAt, "dd MMM yyyy HH:mm")}</dd>
            </div>
          </dl>
          <div id="edit" className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Edit customer</h3>
            <EditCustomerForm customer={customer} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Subscription</h2>
          {currentSubscription ? (
            <div className="space-y-3 text-sm">
              <p className="text-lg font-semibold">{currentSubscription.planName}</p>
              <StatusBadge value={currentSubscription.status} />
              <p>Start {format(currentSubscription.startDate, "dd MMM yyyy")}</p>
              <p>Expiry {format(currentSubscription.expiryDate, "dd MMM yyyy")}</p>
              <p>
                Exports {currentSubscription.exportsUsed} used · {currentSubscription.creditsRemaining} remaining of{" "}
                {currentSubscription.exportAllowance}
              </p>
              <p className="text-[var(--muted)]">
                Entitlement is calculated on the server. Inactive subscriptions are not treated as active access.
              </p>
            </div>
          ) : (
            <EmptyState title="No subscription" body="Assign an active plan to create entitlement." />
          )}
          <form action={asFormAction(changePlanAction)} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="customerId" value={customer.id} />
            <select name="planId" className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2" required>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {plan.durationDays} days
                </option>
              ))}
            </select>
            <input name="reason" required minLength={3} placeholder="Reason for plan change" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <ConfirmSubmit label="Change plan" confirmLabel="Replace the current subscription with this plan?" tone="neutral" />
          </form>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Assigned machine</h2>
          {detail.machines.length === 0 ? (
            <EmptyState title="No machine assigned" body="Assign an available Machine ID. ESP32 IP addresses are not identities." />
          ) : (
            <ul className="space-y-3 text-sm">
              {detail.machines.map(({ machine, display }) => (
                <li key={machine.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{machine.machineId}</p>
                    <StatusBadge value={display.display} />
                  </div>
                  <p className="mt-2 text-[var(--muted)]">Account: {display.account} · Entitlement: {display.entitlement}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Connectivity: {display.connectivity}. {display.connectivityNote}
                  </p>
                  <form action={asFormAction(unassignMachineAction.bind(null, machine.id))} className="mt-3">
                    <ConfirmSubmit label="Unassign" confirmLabel="Unassign this machine from the customer?" tone="neutral" />
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={asFormAction(assignMachineAction)} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="customerId" value={customer.id} />
            <select name="machineDbId" className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2" required>
              <option value="">Select available machine</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.machineId}
                </option>
              ))}
            </select>
            <ConfirmSubmit label="Assign machine" confirmLabel="Assign this machine to the customer?" tone="neutral" />
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Assignment history</h2>
          {detail.assignments.length === 0 ? (
            <EmptyState title="No assignment history" body="Assignments will appear after a machine is bound." />
          ) : (
            <ul className="space-y-3 text-sm">
              {detail.assignments.map((row) => (
                <li key={row.id} className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.machine.machineId}</p>
                    <p className="text-[var(--muted)]">
                      {format(row.assignedAt, "dd MMM yyyy")}
                      {row.unassignedAt ? ` – ${format(row.unassignedAt, "dd MMM yyyy")}` : " – current"}
                    </p>
                  </div>
                  <StatusBadge value={row.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="mb-2 font-semibold">Successful export trend</h2>
        <LineChart
          label="Successful exports"
          points={Object.entries(
            detail.usage
              .filter((row) => row.status === "SUCCESS")
              .reduce<Record<string, number>>((counts, row) => {
                const key = format(row.createdAt, "MMM yyyy");
                counts[key] = (counts[key] ?? 0) + 1;
                return counts;
              }, {}),
          )
            .map(([label, value]) => ({ label, value }))
            .reverse()}
        />
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Usage ledger</h2>
          {detail.usage.length === 0 ? (
            <EmptyState title="No processing jobs" body="Exports and processing jobs appear here when they are recorded." />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.usage.map((row) => (
                <li key={row.id} className="flex justify-between gap-3">
                  <span>
                    {row.jobId} · {row.status} · {row.creditsConsumed} credit
                  </span>
                  <span className="text-[var(--muted)]">{format(row.createdAt, "dd MMM HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Payments</h2>
          {detail.payments.length === 0 ? (
            <EmptyState title="No payments" body="Only recorded transactions are listed. Simulated demo payments are labelled." />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.payments.map((row) => (
                <li key={row.id}>
                  {(row.amountCents / 100).toFixed(2)} {row.currency} · {row.status}
                  {row.simulated ? " · SIMULATED" : ""} · {row.reference}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Extend membership</h2>
          <form action={asFormAction(extendMembershipAction)} className="flex flex-col gap-2">
            <input type="hidden" name="customerId" value={customer.id} />
            <input name="days" type="number" min={1} required placeholder="Days" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <input name="reason" required minLength={3} placeholder="Reason" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <ConfirmSubmit label="Extend" confirmLabel="Extend this membership?" tone="neutral" />
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Adjust credits</h2>
          <form action={asFormAction(grantCreditsAction)} className="flex flex-col gap-2">
            <input type="hidden" name="customerId" value={customer.id} />
            <input name="credits" type="number" required placeholder="Credits, negative to deduct" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <input name="reason" required minLength={3} placeholder="Reason" className="rounded-xl border border-[var(--border)] px-3 py-2" />
            <ConfirmSubmit label="Apply credits" confirmLabel="Apply this credit adjustment?" tone="neutral" />
          </form>
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="mb-3 font-semibold">Login history</h2>
        {detail.logins.length === 0 ? (
          <EmptyState title="No logins" body="Customer sign-in attempts are recorded on the server." />
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.logins.map((row) => (
              <li key={row.id}>
                {format(row.createdAt, "dd MMM yyyy HH:mm")} · {row.success ? "Success" : "Failed"} · {row.method}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-3 font-semibold">Send a message</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Email and WhatsApp stay unsent until provider credentials exist. Demo tenants record a simulated delivery and do not contact a real inbox.
        </p>
        <form action={asFormAction(queueNotificationAction)} className="grid gap-2 md:grid-cols-2">
          <input type="hidden" name="customerId" value={customer.id} />
          <select name="channel" className="rounded-xl border border-[var(--border)] px-3 py-2">
            <option value="IN_APP">In-app record</option>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
          <select name="templateKey" className="rounded-xl border border-[var(--border)] px-3 py-2">
            <option value="renewal">Renewal reminder</option>
            <option value="export-limit">Export limit warning</option>
            <option value="payment">Payment reminder</option>
            <option value="service">Service announcement</option>
          </select>
          <input name="subject" required placeholder="Subject" className="rounded-xl border border-[var(--border)] px-3 py-2 md:col-span-2" />
          <textarea name="body" required placeholder="Message" className="rounded-xl border border-[var(--border)] px-3 py-2 md:col-span-2" />
          <ConfirmSubmit label="Queue message" confirmLabel="Queue this message?" tone="neutral" />
        </form>
        {detail.notifications.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {detail.notifications.map((row) => (
              <li key={row.id}>
                {row.templateKey} · {row.channel} · {row.status}
                {row.simulated ? " · SIMULATED" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="mt-5">
        <h2 className="mb-4 font-semibold">Activity history</h2>
        {detail.activity.length === 0 ? (
          <EmptyState title="No activity" body="Customer events will appear here." />
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.activity.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {item.event.replaceAll("_", " ")}
                  {item.reason ? ` · ${item.reason}` : ""}
                  {item.previousValue ? ` · before ${item.previousValue}` : ""}
                  {item.newValue ? ` · after ${item.newValue}` : ""}
                </span>
                <span className="text-[var(--muted)]">{format(item.createdAt, "dd MMM yyyy HH:mm")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
