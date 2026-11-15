import { checkDatabase } from "@/lib/db";

export async function GET() {
  try {
    await checkDatabase();
    return Response.json({ ok: true, service: "aig-admin", database: "up" });
  } catch {
    console.error("[health] database check failed");
    return Response.json({ ok: false, service: "aig-admin", database: "down" }, { status: 503 });
  }
}
