import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activeAdmin } from "@/lib/current-admin";
import type { AuditActor } from "@/lib/audit";

export async function requireAdmin() {
  const admin = await activeAdmin();
  if (!admin) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null, actor: null };
  }
  const session = await auth();
  const actor: AuditActor = { type: "ADMIN", id: admin.id, email: admin.email, role: admin.role, tenant: admin.tenant };
  return { error: null, session, actor, admin };
}
