/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock functions so they're available before module imports
const { mockLimit, MockRatelimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();

  // Create a proper class mock for Ratelimit
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
  }

  return { mockLimit, MockRatelimit };
});

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: MockRatelimit,
}));

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => ({})),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}));

// Import after mocks are set up
import { checkRateLimit } from "./api";

describe("lib/ratelimit/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date.now for consistent test timing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-16T12:00:00Z"));
  });

  describe("checkRateLimit", () => {
    it("allows request when IP is null (fail-open) without headers", async () => {
      const result = await checkRateLimit(null);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.headers).toBeUndefined();
      }
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("allows request when under rate limit and returns headers", async () => {
      mockLimit.mockResolvedValueOnce({
        success: true,
        limit: 60,
        remaining: 55,
        reset: Date.now() + 60000,
        pending: Promise.resolve(),
      });

      const result = await checkRateLimit("192.168.1.1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.info).toEqual({
          limit: 60,
          remaining: 55,
          reset: expect.any(Number),
        });
        expect(result.headers).toEqual({
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": "55",
          "X-RateLimit-Reset": expect.any(String),
        });
      }
      expect(mockLimit).toHaveBeenCalledWith("192.168.1.1");
    });

    it("returns 429 response when rate limit exceeded", async () => {
      const resetTime = Date.now() + 30000; // 30s from now
      mockLimit.mockResolvedValueOnce({
        success: false,
        limit: 60,
        remaining: 0,
        reset: resetTime,
        pending: Promise.resolve(),
      });

      const result = await checkRateLimit("192.168.1.1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(429);

        const body = await result.error.json();
        expect(body.error).toBe("Rate limit exceeded");
        expect(body.retryAfter).toBe(30);

        expect(result.error.headers.get("X-RateLimit-Limit")).toBe("60");
        expect(result.error.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(result.error.headers.get("Retry-After")).toBe("30");
      }
    });

    it("handles zero remaining correctly at limit boundary", async () => {
      mockLimit.mockResolvedValueOnce({
        success: true, // Still allowed (last request before limit)
        limit: 60,
        remaining: 0,
        reset: Date.now() + 45000,
        pending: Promise.resolve(),
      });

      const result = await checkRateLimit("10.0.0.1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.info?.remaining).toBe(0);
      }
    });

    it("allows request when IP is undefined (fail-open)", async () => {
      const result = await checkRateLimit(undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.headers).toBeUndefined();
      }
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });
});
