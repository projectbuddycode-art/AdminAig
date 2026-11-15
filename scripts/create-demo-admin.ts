import { createPrismaClient } from "../src/lib/prisma-client";
import { loadProjectEnv } from "./load-env";
import { ensureDemoAdmin } from "../prisma/demo-admin";

loadProjectEnv();

const prisma = createPrismaClient();

async function main() {
  const result = await ensureDemoAdmin(prisma);
  if (result.created) {
    console.log(`[demo] Demo administrator created: ${result.email}`);
  } else {
    console.log(`[demo] Demo administrator already exists: ${result.email}`);
    console.log("[demo] The existing password was left unchanged.");
    console.log("[demo] Run npm run demo:reset-password to replace it.");
  }
  console.log("[demo] Role DEMO_ADMIN. Tenant: AIG Demo Tenant. Password was not printed.");
  if (result.auditorEmail) {
    console.log(`[demo] Demo auditor ready: ${result.auditorEmail}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("[demo] Setup failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
