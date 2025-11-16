import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    silent: "passed-only",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/components/ui/**", ...coverageConfigDefaults.exclude],
    },
    // Use forks pool for better isolation and to prevent file handle leaks
    pool: "forks",
  },
});
