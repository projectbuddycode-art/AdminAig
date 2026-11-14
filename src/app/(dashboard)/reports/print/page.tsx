import { currentAdmin } from "@/lib/current-admin";
import { ReportBody } from "@/components/report-body";

export const dynamic = "force-dynamic";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [admin, raw] = await Promise.all([currentAdmin(), searchParams]);
  return <ReportBody admin={admin} raw={raw} print />;
}
