import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "@/mocks/server";

// Start MSW server to intercept requests
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Global mocks for analytics to avoid network/log noise in tests
vi.mock("@domainstack/analytics/server", () => ({
  analytics: {
    track: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    trackException: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  },
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

vi.mock("@domainstack/logger", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn<(...args: unknown[]) => ReturnType<typeof createMockLogger>>(() =>
    createMockLogger(),
  ),
}));

// Mock Next.js after() to execute callbacks immediately in tests
// In production, after() schedules work after the response is sent
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
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
  const actual = await vi.importActual<typeof import("next/cache")>("next/cache");
  return {
    ...actual,
    cacheLife: vi.fn<(...args: unknown[]) => void>(),
    cacheTag: vi.fn<(...args: unknown[]) => void>(),
  };
});

// Make server-only a no-op so we can import server modules in tests
vi.mock("server-only", () => ({}));

// Mock Vercel Workflow metadata functions
// These require the workflow runtime context which isn't available in unit tests
vi.mock("workflow", async () => {
  const actual = await vi.importActual<typeof import("workflow")>("workflow");
  return {
    ...actual,
    getStepMetadata: vi.fn<
      () => { workflowRunId: string; attempt: number; workflowStartedAt: Date }
    >(() => ({
      workflowRunId: `test-run-${Date.now()}`,
      attempt: 1,
      workflowStartedAt: new Date(),
    })),
  };
});

// Mock Redis client to return undefined by default in tests
// This makes code fall back to non-distributed behavior
// Tests that need Redis can override with vi.mocked(getRedis).mockReturnValue(...)
vi.mock("@domainstack/redis", () => ({
  getRedis: vi.fn<() => undefined>(() => undefined),
}));

// Mock rate limiter to avoid Redis timeouts in tests
// The Upstash Ratelimit has a 2s timeout which causes slow tests
vi.mock("@domainstack/redis/ratelimit", () => ({
  getRateLimiter: vi.fn<
    (...args: unknown[]) => {
      limit: (...args: unknown[]) => Promise<{
        success: true;
        limit: number;
        remaining: number;
        reset: number;
        pending: Promise<void>;
      }>;
    }
  >(() => ({
    limit: vi
      .fn<
        (...args: unknown[]) => Promise<{
          success: true;
          limit: number;
          remaining: number;
          reset: number;
          pending: Promise<void>;
        }>
      >()
      .mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60000,
        pending: Promise.resolve(),
      }),
  })),
  DEFAULT_RATE_LIMIT: { requests: 60, window: "1 m" },
}));
