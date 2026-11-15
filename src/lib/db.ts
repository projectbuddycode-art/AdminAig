import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// The client is created on first use so `next build` can load route modules
// before the hosting environment supplies DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
