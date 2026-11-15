import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
