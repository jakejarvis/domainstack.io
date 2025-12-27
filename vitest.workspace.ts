import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // Node tests: services, database repos, pure logic
  {
    plugins: [tsconfigPaths(), react()],
    test: {
      name: "node",
      environment: "node",
      setupFiles: ["./vitest.setup.node.ts"],
      globals: true,
      silent: "passed-only",
      include: ["server/**/*.test.ts", "lib/**/*.test.ts"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        // Exclude tsx tests - they run in browser
        "**/*.test.tsx",
        // Exclude lib/json-export.test.ts - it needs DOM (browser)
        "lib/json-export.test.ts",
      ],
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        exclude: ["**/components/ui/**", ...coverageConfigDefaults.exclude],
      },
      pool: "threads",
    },
  },
  // Browser tests: React components
  {
    plugins: [tsconfigPaths(), react()],
    test: {
      name: "browser",
      setupFiles: ["./vitest.setup.browser.ts"],
      globals: true,
      silent: "passed-only",
      include: [
        "components/**/*.test.tsx",
        "lib/**/*.test.tsx",
        // Include lib/json-export.test.ts - it needs DOM
        "lib/json-export.test.ts",
      ],
      exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
      browser: {
        enabled: true,
        provider: "playwright",
        instances: [{ browser: "chromium" }],
      },
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        exclude: ["**/components/ui/**", ...coverageConfigDefaults.exclude],
      },
    },
  },
]);
