import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { ensureCatalog, ensureMembership } from "./catalog";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DemoAdminResult = {
  email: string;
  created: boolean;
  passwordUpdated: boolean;
  auditorEmail: string | null;
};

export function assertDemoBootstrapAllowed() {
  if (process.env.VERCEL === "1" || process.env.NEXT_PHASE === "phase-production-build") {
    throw new Error("Demo administrator bootstrap does not run on Vercel.");
  }
  if (process.env.DEMO_TENANT_ENABLED !== "true") {
    throw new Error("Set DEMO_TENANT_ENABLED=true before creating the demo administrator.");
  }
}

export function demoAdminCredentials() {
  assertDemoBootstrapAllowed();
  const email = (process.env.DEMO_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD ?? "";
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("DEMO_ADMIN_EMAIL must be set to a valid email address.");
  }
  if (password.length < 12) {
    throw new Error("DEMO_ADMIN_PASSWORD must be set and be at least 12 characters. It is not printed.");
  }
  return { email, password };
}

export async function ensureDemoAdmin(
  db: PrismaClient,
  options?: { resetPassword?: boolean },
): Promise<DemoAdminResult> {
  const resetPassword = options?.resetPassword === true;
  const { email, password } = demoAdminCredentials();
  await ensureCatalog(db);

  const existing = await db.admin.findUnique({ where: { email } });
  if (existing && existing.tenant !== "demo") {
    throw new Error("An administrator with this email already exists outside the demo tenant.");
  }

  const passwordHash = !existing || resetPassword ? await hash(password, 12) : existing.passwordHash;
  const admin = existing
    ? await db.admin.update({
        where: { id: existing.id },
        data: {
          name: "AIG Demo Administrator",
          role: "DEMO_ADMIN",
          status: "ACTIVE",
          tenant: "demo",
          deletedAt: null,
          ...(resetPassword ? { passwordHash } : {}),
        },
      })
    : await db.admin.create({
        data: {
          name: "AIG Demo Administrator",
          email,
          passwordHash,
          role: "DEMO_ADMIN",
          status: "ACTIVE",
          tenant: "demo",
        },
      });

  const production = await db.tenant.findUnique({ where: { key: "production" } });
  if (production) {
    await db.tenantMembership.deleteMany({ where: { adminId: admin.id, tenantId: production.id } });
  }
  await ensureMembership(db, admin.id, "demo", "DEMO_ADMIN");

  let auditorEmail: string | null = null;
  const configuredAuditor = (process.env.DEMO_AUDITOR_EMAIL ?? "").trim().toLowerCase();
  const auditorPassword = process.env.DEMO_AUDITOR_PASSWORD ?? "";
  if (configuredAuditor || auditorPassword) {
    if (!EMAIL_PATTERN.test(configuredAuditor)) {
      throw new Error("DEMO_AUDITOR_EMAIL must be a valid email address.");
    }
    if (auditorPassword.length < 12) {
      throw new Error("DEMO_AUDITOR_PASSWORD must be at least 12 characters. It is not printed.");
    }
    const auditorExisting = await db.admin.findUnique({ where: { email: configuredAuditor } });
    if (auditorExisting && auditorExisting.tenant !== "demo") {
      throw new Error("The auditor email already exists outside the demo tenant.");
    }
    const auditorHash = !auditorExisting || resetPassword ? await hash(auditorPassword, 12) : auditorExisting.passwordHash;
    const auditor = auditorExisting
      ? await db.admin.update({
          where: { id: auditorExisting.id },
          data: {
            name: "Demo Auditor",
            role: "AUDITOR",
            status: "ACTIVE",
            tenant: "demo",
            deletedAt: null,
            ...(resetPassword ? { passwordHash: auditorHash } : {}),
          },
        })
      : await db.admin.create({
          data: {
            name: "Demo Auditor",
            email: configuredAuditor,
            passwordHash: auditorHash,
            role: "AUDITOR",
            status: "ACTIVE",
            tenant: "demo",
          },
        });
    await ensureMembership(db, auditor.id, "demo", "AUDITOR");
    auditorEmail = auditor.email;
  }

  return {
    email: admin.email,
    created: !existing,
    passwordUpdated: !existing || resetPassword,
    auditorEmail,
  };
}
