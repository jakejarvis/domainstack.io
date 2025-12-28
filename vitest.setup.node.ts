import { vi } from "vitest";

// Global mocks for analytics to avoid network/log noise in tests
vi.mock("@/lib/analytics/server", () => ({
  analytics: {
    track: vi.fn(async () => undefined),
    trackException: vi.fn(async () => undefined),
  },
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

vi.mock("@/lib/logger/server", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn(() => createMockLogger()),
}));

// Mock Next.js after() to execute callbacks immediately in tests
// In production, after() schedules work after the response is sent
vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      // Execute immediately in tests and return promise for proper test awaiting
      // Swallow errors like production after() does
      return Promise.resolve(callback()).catch(() => {
        // Error silently handled
      });
    },
  };
});

// Mock Next.js cache functions that require cacheComponents config
// These are no-ops in tests since we don't need actual caching behavior
vi.mock("next/cache", async () => {
  const actual =
    await vi.importActual<typeof import("next/cache")>("next/cache");
  return {
    ...actual,
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
  };
});

// Make server-only a no-op so we can import server modules in tests
vi.mock("server-only", () => ({}));
