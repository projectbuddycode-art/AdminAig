import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function currentAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const admin = await prisma.admin.findUnique({ where: { id: session.user.id } });
  if (!admin || admin.status !== "ACTIVE" || admin.deletedAt) redirect("/login");
  return admin;
}
