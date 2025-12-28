import { defineProject, mergeConfig } from "vitest/config";
import sharedConfig from "./vitest.shared";

export default mergeConfig(
  sharedConfig,
  defineProject({
    test: {
      name: "node",
      include: ["**/*.test.ts"],
      environment: "node",
      setupFiles: ["./vitest.setup.node.ts"],
    },
  }),
);
