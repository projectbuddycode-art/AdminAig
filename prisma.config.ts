import { defineConfig } from "prisma/config";
import { loadProjectEnv } from "./scripts/load-env";

loadProjectEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
