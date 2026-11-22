import type { Admin } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { databaseConfigured } from "@/lib/prisma-client";

function guestAdmin(): Admin {
  const now = new Date();
  return {
    id: "open-access-admin",
    name: process.env.ADMIN_NAME || "AIG Administrator",
    email: (process.env.ADMIN_EMAIL || "admin@aig.local").toLowerCase(),
    passwordHash: "",
    status: "ACTIVE",
    role: "SUPER_ADMIN",
    tenant: "production",
    lastLoginAt: now,
    deletedAt: null,
    createdAt: now,
  };
}

async function resolveAdmin(): Promise<Admin> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
      if (admin && admin.status === "ACTIVE" && !admin.deletedAt) return admin;
    }
  } catch {
    // Continue without a session.
  }

  if (!databaseConfigured()) return guestAdmin();

  try {
    const email = (process.env.ADMIN_EMAIL || "admin@aig.local").toLowerCase();
    const byEmail = await prisma.admin.findUnique({ where: { email } });
    if (byEmail && byEmail.status === "ACTIVE" && !byEmail.deletedAt) return byEmail;
    const any = await prisma.admin.findFirst({
      where: { status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return any ?? guestAdmin();
  } catch {
    return guestAdmin();
  }
}

export async function activeAdmin(): Promise<Admin | null> {
  return resolveAdmin();
}

export async function currentAdmin() {
  return resolveAdmin();
}
