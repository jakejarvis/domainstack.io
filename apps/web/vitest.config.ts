import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "next/image": new URL("./mocks/next-image.ts", import.meta.url).pathname,
    },
    tsconfigPaths: true,
  },
  define: {
    "process.env.NEXT_PUBLIC_BASE_URL": JSON.stringify(
      "https://test.domainstack.io",
    ),
  },
  test: {
    globals: true,
    silent: "passed-only",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/components/ui/**", ...coverageConfigDefaults.exclude],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["**/*.test.ts"],
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          // Node tests share the MSW server, so run files serially to avoid
          // resetHandlers() races with in-flight fetches.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              {
                browser: "chromium",
              },
            ],
            viewport: {
              width: 1280,
              height: 720,
            },
          },
          setupFiles: ["./vitest.setup.browser.ts"],
        },
      },
    ],
    // Use threads pool for compatibility with sandboxed environments
    // File handle cleanup is managed by afterAll hooks in test files (e.g., PGlite.close())
    pool: "threads",
  },
});
