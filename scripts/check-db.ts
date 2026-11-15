import { createPrismaClient } from "../src/lib/prisma-client";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const prisma = createPrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("[database] Connection succeeded.");
}

main()
  .catch(() => {
    console.error("[database] Connection failed.");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
