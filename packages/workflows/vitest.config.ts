import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_BASE_URL": JSON.stringify("https://test.domainstack.io"),
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Some tests share an MSW server instance, so run files serially to
    // avoid resetHandlers() races with in-flight fetches.
    fileParallelism: false,
  },
});
