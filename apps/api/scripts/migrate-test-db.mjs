/**
 * Apply Prisma migrations to the isolated test database.
 */
import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(apiRoot, "../..");
config({ path: join(apiRoot, ".env") });
config({ path: join(repoRoot, ".env") });

const testUrl =
  process.env.TEST_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.replace(/\/claimchecker(\?|$)/, "/claimchecker_test$1") ||
  "postgresql://claimchecker:claimchecker@127.0.0.1:55432/claimchecker_test?schema=public";

process.env.DATABASE_URL = testUrl;
process.env.TEST_DATABASE_URL = testUrl;

console.log("[migrate-test-db] DATABASE_URL → claimchecker_test (or TEST_DATABASE_URL)");

const result = spawnSync(
  "pnpm",
  ["exec", "prisma", "migrate", "deploy"],
  {
    cwd: apiRoot,
    env: process.env,
    stdio: "inherit",
    shell: true,
  },
);

process.exit(result.status ?? 1);
