import { createPrismaClient } from "../src/lib/prisma-client";
import { loadProjectEnv } from "./load-env";
import { ensureDemoAdmin } from "../prisma/demo-admin";

loadProjectEnv();

const prisma = createPrismaClient();

async function main() {
  const result = await ensureDemoAdmin(prisma, { resetPassword: true });
  if (result.created) {
    console.log(`[demo] Demo administrator created: ${result.email}`);
  } else {
    console.log(`[demo] Demo administrator password replaced: ${result.email}`);
  }
  console.log("[demo] The new password was taken from DEMO_ADMIN_PASSWORD and was not printed.");
}

main()
  .catch((error: unknown) => {
    console.error("[demo] Password reset failed.");
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
