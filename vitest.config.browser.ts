import { defineProject, mergeConfig } from "vitest/config";
import sharedConfig from "./vitest.shared";
import { playwright } from "@vitest/browser-playwright";

export default mergeConfig(
  sharedConfig,
  defineProject({
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
      },
      setupFiles: ["./vitest.setup.browser.ts"],
    },
  })
);
