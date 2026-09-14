import { vi } from "vitest";

import { getRedis } from "@domainstack/redis";

// Mock Redis client to return undefined by default in tests
// This makes code fall back to non-distributed behavior
// Tests that need Redis can override with vi.mocked(getRedis).mockReturnValue(...)
vi.mock("@domainstack/redis", () => ({
  getRedis: vi.fn<() => undefined>(() => undefined),
}));

type FakeLimiter = {
  limit: (...args: unknown[]) => Promise<{
    success: true;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<void>;
  }>;
};

// Mock rate limiter to avoid Redis timeouts in tests. Mirrors the real
// getRateLimiter's null-when-no-Redis check so overriding getRedis (above)
// also flips this mock's behavior, instead of the two mocks disagreeing.
vi.mock("@domainstack/redis/ratelimit", () => ({
  getRateLimiter: vi.fn<(...args: unknown[]) => FakeLimiter | null>(() => {
    if (!getRedis()) return null;

    return {
      limit: vi.fn<FakeLimiter["limit"]>().mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60000,
        pending: Promise.resolve(),
      }),
    };
  }),
  DEFAULT_RATE_LIMIT: { requests: 60, window: "1 m" },
}));

// Global mocks for analytics to avoid network/log noise in tests
vi.mock("./src/analytics", () => ({
  analytics: {
    track: vi.fn<(...args: unknown[]) => void>(),
    identify: vi.fn<(...args: unknown[]) => void>(),
    trackException: vi.fn<(...args: unknown[]) => void>(),
  },
  captureException: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
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
