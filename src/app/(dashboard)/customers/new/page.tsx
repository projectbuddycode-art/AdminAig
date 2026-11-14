import { prisma } from "@/lib/db";
import { listActivePlans, listAssignableMachines } from "@/server/queries";
import { CreateCustomerForm } from "@/components/customer-forms";
import { PageHeader } from "@/components/ui";
import { currentAdmin } from "@/lib/current-admin";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const admin = await currentAdmin();
  const [plans, machines] = await Promise.all([
    listActivePlans(prisma, admin.tenant),
    listAssignableMachines(prisma, admin.tenant),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Create customer"
        description="A plan is required. Machine assignment is optional and only lists unassigned machines."
      />
      <CreateCustomerForm plans={plans} machines={machines} />
    </>
  );
}
