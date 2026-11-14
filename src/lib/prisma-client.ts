import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

function resolveSqliteUrl() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;
  const filePart = raw.slice("file:".length);
  const windowsAbsolute = /^[A-Za-z]:[\\/]/.test(filePart);
  const absolute = windowsAbsolute || filePart.startsWith("/") || filePart.startsWith("\\\\");
  if (absolute) return `file:${filePart}`;
  const relative = filePart.replace(/^\.\//, "");
  return `file:${path.resolve(process.cwd(), "prisma", relative)}`;
}

export function createPrismaClient() {
  const adapter = new PrismaLibSQL({ url: resolveSqliteUrl() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}
