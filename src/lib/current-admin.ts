import { redirect } from "next/navigation";
import type { Admin } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { databaseConfigured } from "@/lib/prisma-client";
import { openDashboardAccess } from "@/lib/open-access";

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

async function openAccessAdmin(): Promise<Admin | null> {
  if (!openDashboardAccess()) return null;
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
  const session = await auth();
  if (session?.user?.id) {
    try {
      const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
      if (admin && admin.status === "ACTIVE" && !admin.deletedAt) return admin;
    } catch {
      // Fall through to open-access guest when the database is unavailable.
    }
  }
  return openAccessAdmin();
}

export async function currentAdmin() {
  const admin = await activeAdmin();
  if (!admin) redirect("/login");
  return admin;
}
