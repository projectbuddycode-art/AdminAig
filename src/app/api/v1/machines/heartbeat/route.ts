import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readBearer, verifyCustomerToken } from "@/lib/customer-jwt";
import { recordVerifiedHeartbeat } from "@/server/domain";
import { normalizeMachineId } from "@/lib/machine-id";

export async function POST(request: Request) {
  const token = readBearer(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await verifyCustomerToken(token);
    const body = await request.json();
    const machineId = normalizeMachineId(String(body.machineId ?? ""));
    const machine = await prisma.machine.findUnique({ where: { machineId } });
    if (!machine || machine.customerId !== payload.sub || machine.status !== "ASSIGNED") {
      return NextResponse.json({ error: "Machine is not assigned to this customer." }, { status: 403 });
    }
    await recordVerifiedHeartbeat(prisma, machine.id);
    return NextResponse.json({ ok: true, connectivity: "Online", machineId: machine.machineId });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
