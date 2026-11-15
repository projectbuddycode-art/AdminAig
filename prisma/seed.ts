import { hash } from "bcryptjs";
import { createPrismaClient } from "../src/lib/prisma-client";
import { loadProjectEnv } from "../scripts/load-env";
import { ensureCatalog, ensureMembership } from "./catalog";

loadProjectEnv();

const prisma = createPrismaClient();

async function main() {
  await ensureCatalog(prisma);

  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME ?? "AIG Administrator";
  if (!email || password.length < 12) {
    console.warn("[seed] ADMIN_EMAIL or ADMIN_PASSWORD is missing or shorter than 12 characters. No administrator was created.");
    return;
  }

  const passwordHash = await hash(password, 12);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { name, passwordHash, status: "ACTIVE", role: "SUPER_ADMIN", tenant: "production", deletedAt: null },
    create: { name, email, passwordHash, status: "ACTIVE", role: "SUPER_ADMIN", tenant: "production" },
  });
  await ensureMembership(prisma, admin.id, "production", "SUPER_ADMIN");
  console.log(`[seed] Production administrator ready: ${admin.email}`);
  console.log("[seed] Password was taken from ADMIN_PASSWORD and is not printed.");
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
