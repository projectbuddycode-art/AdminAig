import type { Admin } from "@prisma/client";

export const TEMPORARY_COOKIE = "aig_temporary_login";

export function temporaryAdminRecord(): Admin {
  const now = new Date();
  return {
    id: "temporary",
    name: "Temporary access",
    email: "temporary@localhost",
    passwordHash: "",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    tenant: "production",
    lastLoginAt: now,
    deletedAt: null,
    createdAt: now,
  };
}
