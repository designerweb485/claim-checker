import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Force TEST_DATABASE_URL before any test file loads Prisma.
    setupFiles: ["./src/test/vitest-env.ts"],
  },
});


