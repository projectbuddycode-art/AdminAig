import { redirect } from "next/navigation";
import type { Admin } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function activeAdmin(): Promise<Admin | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
  if (!admin || admin.status !== "ACTIVE" || admin.deletedAt) return null;
  return admin;
}

export async function currentAdmin() {
  const admin = await activeAdmin();
  if (!admin) redirect("/login");
  return admin;
}
