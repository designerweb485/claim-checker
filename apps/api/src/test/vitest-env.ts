/**
 * Point Prisma at TEST_DATABASE_URL so integration tests never wipe the demo DB.
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = join(apiRoot, "../..");
config({ path: join(apiRoot, ".env") });
config({ path: join(repoRoot, ".env") });

const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
} else if (process.env.CI === "true") {
  throw new Error(
    "TEST_DATABASE_URL (or CI DATABASE_URL) is required so tests do not use the demo database.",
  );
} else {
  // Local fallback: same host, dedicated test database name.
  process.env.DATABASE_URL =
    process.env.DATABASE_URL?.replace(/\/claimchecker(\?|$)/, "/claimchecker_test$1") ??
    "postgresql://claimchecker:claimchecker@127.0.0.1:55432/claimchecker_test?schema=public";
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}
