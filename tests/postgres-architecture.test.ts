import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decimalFromCents } from "@/lib/money";
import { isValidMachineIdFormat } from "@/lib/machine-id";
import { buildDemoDataset, demoDatasetCounts, demoMachineCode, paymentKind, subscriptionKind } from "../prisma/demo-fixtures";

describe("postgres architecture", () => {
  it("stores money as a two-decimal major amount", () => {
    expect(decimalFromCents(490000)).toBe("4900.00");
    expect(decimalFromCents(0)).toBe("0.00");
    expect(decimalFromCents(-250)).toBe("-2.50");
  });

  it("builds a deterministic demo tenant with the required mix", () => {
    const now = new Date("2026-11-15T00:00:00.000Z");
    const first = buildDemoDataset(now);
    const second = buildDemoDataset(now);
    const counts = demoDatasetCounts(now);
    expect(counts).toMatchObject({
      customers: 25,
      machines: 20,
      plans: 3,
      payments: 25,
      notifications: 25,
      audits: 25,
    });
    expect(counts.usage).toBeGreaterThan(25);
    expect(counts.refunds).toBeGreaterThan(0);
    expect(new Set(first.customers.map((row) => row.email)).size).toBe(25);
    expect(new Set(first.usage.map((row) => row.idempotencyKey)).size).toBe(first.usage.length);
    expect(first.customers.map((row) => row.email)).toEqual(second.customers.map((row) => row.email));
    expect(first.usage.map((row) => row.idempotencyKey)).toEqual(second.usage.map((row) => row.idempotencyKey));
    const kinds = new Set(first.customers.map((row) => row.kind));
    expect(kinds).toEqual(new Set(["ACTIVE", "EXPIRED", "SUSPENDED", "TRIAL"]));
    const payments = new Set(Array.from({ length: 25 }, (_, index) => paymentKind(index + 1)));
    expect(payments.has("PENDING")).toBe(true);
    expect(payments.has("REFUNDED")).toBe(true);
    expect(payments.has("FAILED")).toBe(true);
    expect(subscriptionKind(11)).toBe("SUSPENDED");
    const codes = Array.from({ length: 20 }, (_, index) => demoMachineCode(index + 1));
    expect(new Set(codes).size).toBe(20);
    expect(codes.every((code) => isValidMachineIdFormat(code))).toBe(true);
    expect(first.machines.filter((row) => row.customerId === first.customers[0].id)).toHaveLength(2);
    expect(first.payments.every((row) => row.simulated)).toBe(true);
    expect(first.customers.every((row) => row.tenant === "demo")).toBe(true);
    expect(first.usage.filter((row) => row.status === "FAILED").length).toBeGreaterThan(0);
  });

  it("commits a postgresql migration instead of sqlite", () => {
    const root = process.cwd();
    const lock = readFileSync(path.join(root, "prisma", "migrations", "migration_lock.toml"), "utf8");
    const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
    expect(lock).toContain('provider = "postgresql"');
    expect(schema).toContain('provider  = "postgresql"');
    expect(schema).not.toContain('provider = "sqlite"');
    const migrationDir = readdirSync(path.join(root, "prisma", "migrations")).find((entry) => entry !== "migration_lock.toml");
    expect(migrationDir).toBeTruthy();
    const sql = readFileSync(path.join(root, "prisma", "migrations", migrationDir!, "migration.sql"), "utf8");
    expect(sql).toContain('CREATE TABLE "Customer"');
    expect(sql).toContain('CREATE TABLE "UsageEntry"');
    expect(sql).toContain("DECIMAL(12,2)");
    expect(sql.toLowerCase()).not.toContain("sqlite");
    expect(sql).not.toContain("AUTOINCREMENT");
  });
});
