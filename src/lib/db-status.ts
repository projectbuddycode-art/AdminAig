import { prisma } from "@/lib/db";
import { openDashboardAccess } from "@/lib/open-access";

let cached: { ok: boolean; checkedAt: number } | null = null;
const TTL_MS = 5_000;

export async function databaseReachable() {
  const now = Date.now();
  if (cached && now - cached.checkedAt < TTL_MS) return cached.ok;
  try {
    await prisma.$queryRaw`SELECT 1`;
    cached = { ok: true, checkedAt: now };
    return true;
  } catch {
    cached = { ok: false, checkedAt: now };
    return false;
  }
}

export async function useOfflineDemo() {
  return openDashboardAccess() && !(await databaseReachable());
}
