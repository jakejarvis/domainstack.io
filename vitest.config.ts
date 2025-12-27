import path from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

// Shared path alias configuration
const aliasConfig = {
  "@": path.resolve(__dirname, "./"),
};

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
      // Node tests: services, database repos, pure logic
      {
        resolve: {
          alias: aliasConfig,
        },
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
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
          pool: "threads",
        },
      },
      // Browser tests: React components
      {
        resolve: {
          alias: aliasConfig,
        },
        test: {
          name: "browser",
          setupFiles: ["./vitest.setup.browser.ts"],
          include: [
            "components/**/*.test.tsx",
            "lib/**/*.test.tsx",
            // Include lib/json-export.test.ts - it needs DOM
            "lib/json-export.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
