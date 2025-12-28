// Shim process for Next.js components
// @ts-expect-error
globalThis.process = {
  env: { NODE_ENV: "test" },
  cwd: () => "/",
};

import "./vitest.setup.common";
import "@testing-library/jest-dom/vitest";
