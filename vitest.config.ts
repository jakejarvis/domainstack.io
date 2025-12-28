import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./vitest.config.node.ts",
      "./vitest.config.browser.ts",
    ],
  },
});
