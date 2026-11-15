import type { PrismaClient } from "@prisma/client";
import { rolePermissionCatalog } from "../src/lib/rbac";

const TENANTS = [
  { id: "tenant_production", key: "production", name: "Production", kind: "PRODUCTION" },
  { id: "tenant_demo", key: "demo", name: "AIG Demo Tenant", kind: "DEMO" },
] as const;

export async function ensureCatalog(db: PrismaClient) {
  for (const tenant of TENANTS) {
    await db.tenant.upsert({
      where: { key: tenant.key },
      update: { name: tenant.name, kind: tenant.kind },
      create: tenant,
    });
  }

  const catalog = rolePermissionCatalog();
  for (const entry of catalog) {
    await db.role.upsert({
      where: { code: entry.role },
      update: { name: entry.role },
      create: { id: `role_${entry.role.toLowerCase()}`, code: entry.role, name: entry.role },
    });
  }

  const permissionCodes = [...new Set(catalog.flatMap((entry) => entry.permissions))];
  for (const code of permissionCodes) {
    await db.permission.upsert({
      where: { code },
      update: {},
      create: { id: `perm_${code.replaceAll(".", "_")}`, code, description: code },
    });
  }

  for (const entry of catalog) {
    const role = await db.role.findUniqueOrThrow({ where: { code: entry.role } });
    for (const code of entry.permissions) {
      const permission = await db.permission.findUniqueOrThrow({ where: { code } });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

export async function ensureMembership(db: PrismaClient, adminId: string, tenantKey: string, role: string) {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { key: tenantKey } });
  await db.tenantMembership.upsert({
    where: { tenantId_adminId: { tenantId: tenant.id, adminId } },
    update: { role },
    create: { tenantId: tenant.id, adminId, role },
  });
}
