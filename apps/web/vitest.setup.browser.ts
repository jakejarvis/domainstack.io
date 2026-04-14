// Shim process for Next.js components
// @ts-expect-error
globalThis.process = {
  env: { NODE_ENV: "test" },
  cwd: () => "/",
};

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock fetch to prevent network requests
globalThis.fetch = vi.fn<typeof fetch>(() => {
  throw new Error("Network requests are not allowed in tests. Please mock fetch.");
});

vi.mock("@domainstack/analytics/client", () => ({
  analytics: {
    track: vi.fn<(...args: unknown[]) => void>(),
    trackException: vi.fn<(...args: unknown[]) => void>(),
  },
  useAnalytics: () => ({
    track: vi.fn<(...args: unknown[]) => void>(),
    trackException: vi.fn<(...args: unknown[]) => void>(),
  }),
}));

// Mock logger to avoid noise in tests
type MockLogger = Record<
  "log" | "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "child",
  ReturnType<typeof vi.fn>
>;

const createMockLogger = (): MockLogger => ({
  log: vi.fn<(...args: unknown[]) => void>(),
  trace: vi.fn<(...args: unknown[]) => void>(),
  debug: vi.fn<(...args: unknown[]) => void>(),
  info: vi.fn<(...args: unknown[]) => void>(),
  warn: vi.fn<(...args: unknown[]) => void>(),
  error: vi.fn<(...args: unknown[]) => void>(),
  fatal: vi.fn<(...args: unknown[]) => void>(),
  child: vi.fn<(...args: unknown[]) => MockLogger>(() => createMockLogger()),
});

vi.mock("@/lib/logger/client", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn<(...args: unknown[]) => ReturnType<typeof createMockLogger>>(() =>
    createMockLogger(),
  ),
}));
