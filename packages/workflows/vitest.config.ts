import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_BASE_URL": JSON.stringify("https://test.domainstack.io"),
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Suites import the Workflow SDK, React Email and the Drizzle schema; under
    // `pnpm test` (all packages + Chromium in parallel) cold imports can be slow.
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
