/**
 * Test doubles for @domainstack/redis. Import only from vitest setup files:
 *   vi.mock("@domainstack/redis", async () =>
 *     (await import("@domainstack/redis/testing")).mockRedisModule());
 *   vi.mock("@domainstack/redis/ratelimit", async () =>
 *     (await import("@domainstack/redis/testing")).mockRateLimitModule());
 */
import { vi } from "vitest";

/**
 * Returns no Redis client by default so code falls back to non-distributed
 * behavior. Tests that need Redis can override with
 * vi.mocked(getRedis).mockReturnValue(...)
 */
export function mockRedisModule() {
  return {
    getRedis: vi.fn<() => undefined>(() => undefined),
  };
}

type FakeLimiter = {
  limit: (...args: unknown[]) => Promise<{
    success: true;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<void>;
  }>;
};

/**
 * Mock rate limiter to avoid Redis timeouts in tests. Mirrors the real
 * getRateLimiter's null-when-no-Redis check, so a test that overrides getRedis
 * flips this mock's behavior too, instead of the two mocks disagreeing.
 */
export async function mockRateLimitModule() {
  // Resolves to the mocked module from mockRedisModule() when it is registered.
  const { getRedis } = await import("@domainstack/redis");

  return {
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
  };
}
