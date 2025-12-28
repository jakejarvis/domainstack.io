// Shim process for Next.js components
// @ts-expect-error
globalThis.process = {
  env: { NODE_ENV: "test" },
  cwd: () => "/",
};

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock fetch to prevent network requests
globalThis.fetch = vi.fn(() => {
  throw new Error(
    "Network requests are not allowed in tests. Please mock fetch.",
  );
});

vi.mock("@/lib/analytics/client", () => ({
  analytics: {
    track: vi.fn(),
    trackException: vi.fn(),
  },
  useAnalytics: () => ({
    track: vi.fn(),
    trackException: vi.fn(),
  }),
}));

// Mock logger to avoid noise in tests
const createMockLogger = () => ({
  log: vi.fn(),
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => createMockLogger()),
});

vi.mock("@/lib/logger/client", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn(() => createMockLogger()),
}));
