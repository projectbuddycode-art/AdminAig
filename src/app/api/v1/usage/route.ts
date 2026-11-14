import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readBearer, verifyCustomerToken } from "@/lib/customer-jwt";
import { recordUsage } from "@/server/domain";
import { isAppError } from "@/lib/errors";

export async function POST(request: Request) {
  const token = readBearer(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await verifyCustomerToken(token);
    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const result = await recordUsage(
      {
        db: prisma,
        actor: { type: "CUSTOMER", id: customer.id, email: customer.email, tenant: customer.tenant },
      },
      {
        customerId: customer.id,
        jobId: String(body.jobId ?? ""),
        idempotencyKey: String(body.idempotencyKey ?? body.jobId ?? ""),
        status: body.status === "FAILED" ? "FAILED" : "SUCCESS",
        preset: body.preset ? String(body.preset) : undefined,
        sourceRecording: body.sourceRecording ? String(body.sourceRecording) : undefined,
        durationMs: body.durationMs ? Number(body.durationMs) : undefined,
        failureReason: body.failureReason ? String(body.failureReason) : undefined,
      },
    );
    return NextResponse.json({ duplicate: result.duplicate, creditsConsumed: result.entry.creditsConsumed, status: result.entry.status });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
