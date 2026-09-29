import { vi } from "vitest";

// Mock Redis client to return undefined by default in tests
// This makes code fall back to non-distributed behavior
// Tests that need Redis can override with vi.mocked(getRedis).mockReturnValue(...)
vi.mock("@domainstack/redis", async () =>
  (await import("@domainstack/redis/testing")).mockRedisModule(),
);

// Mock rate limiter to avoid Redis timeouts in tests. Mirrors the real
// getRateLimiter's null-when-no-Redis check, so overriding getRedis (above)
// also flips this mock's behavior.
vi.mock("@domainstack/redis/ratelimit", async () =>
  (await import("@domainstack/redis/testing")).mockRateLimitModule(),
);

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
vi.mock("@domainstack/logger", async () =>
  (await import("@domainstack/logger/testing")).mockLoggerModule(),
);
