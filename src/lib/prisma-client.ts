import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPool = globalThis as unknown as { aigPgPool?: Pool };

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (value.startsWith("file:")) {
    throw new Error("SQLite DATABASE_URL is not supported. Use a PostgreSQL connection string.");
  }
  return value;
}

function sslConfig(url: string): { rejectUnauthorized: boolean } | undefined {
  if (/localhost|127\.0\.0\.1/.test(url) || url.includes("sslmode=disable")) return undefined;
  if (/supabase\.(com|co)/.test(url)) {
    return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" };
  }
  return undefined;
}

export function createPrismaClient() {
  const url = connectionString();
  const reusable = process.env.NODE_ENV !== "test";
  let pool = reusable ? globalForPool.aigPgPool : undefined;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
      ssl: sslConfig(url),
    });
    pool.on("error", (error: Error & { code?: string }) => {
      const code = error.code ? ` (${error.code})` : "";
      console.error(`[database] connection error${code}`);
    });
    if (reusable) globalForPool.aigPgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}
