import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const port = 54330;
const databaseDir = "prisma/.local-pg";
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

async function main() {
  const fresh = !existsSync(databaseDir);
  if (fresh) await postgres.initialise();
  await postgres.start();
  if (fresh) await postgres.createDatabase("aig");
  console.log(`[local-postgres] ready postgresql://postgres@127.0.0.1:${port}/aig`);
  await new Promise(() => {});
}

main().catch((error: unknown) => {
  console.error("[local-postgres] Failed.");
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
});
