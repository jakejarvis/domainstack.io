import react from "@vitejs/plugin-react";
import { coverageConfigDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname || process.cwd()),
    },
  },
  test: {
    // setupFiles handled by workspace
    globals: true,
    silent: "passed-only",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/components/ui/**", ...coverageConfigDefaults.exclude],
    },
    // Use threads pool for compatibility with sandboxed environments
    // File handle cleanup is managed by afterAll hooks in test files (e.g., PGlite.close())
    pool: "threads",
  },
});
