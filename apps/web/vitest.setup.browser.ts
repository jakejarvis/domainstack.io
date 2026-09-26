// Shim process for Next.js components
// @ts-expect-error
globalThis.process = {
  env: { NODE_ENV: "test" },
  cwd: () => "/",
};

import { vi } from "vitest";
import "vitest-browser-react";

import "./app/globals.css";

// Mock fetch to prevent network requests
globalThis.fetch = vi.fn<typeof fetch>(() => {
  throw new Error("Network requests are not allowed in tests. Please mock fetch.");
});

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn<(...args: unknown[]) => void>(),
    captureException: vi.fn<(...args: unknown[]) => void>(),
    identify: vi.fn<(...args: unknown[]) => void>(),
    reset: vi.fn<(...args: unknown[]) => void>(),
    setPersonProperties: vi.fn<(...args: unknown[]) => void>(),
  },
}));
