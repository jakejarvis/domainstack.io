/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Unmock @domainstack/redis/ratelimit from global setup so we can test the actual implementation
// This file tests the checkRateLimit function itself, so we need the real module
vi.unmock("@domainstack/redis/ratelimit");

// Hoist mock functions so they're available before module imports
const { mockLimit, mockIpAddress, mockGetSession, mockGetRateLimiter } =
  vi.hoisted(() => {
    const mockLimit = vi.fn();
    const mockIpAddress = vi.fn();
    const mockGetSession = vi.fn();
    const mockGetRateLimiter = vi.fn();

    return { mockLimit, mockIpAddress, mockGetSession, mockGetRateLimiter };
  });

// Mock the ratelimit module that the actual code uses
vi.mock("@domainstack/redis/ratelimit", () => ({
  getRateLimiter: mockGetRateLimiter,
  DEFAULT_RATE_LIMIT: { requests: 60, window: "1 m" },
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
  ipAddress: mockIpAddress,
}));

vi.mock("@domainstack/auth/server", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

// Import after mocks are set up
import { checkRateLimit } from "./api";

/**
 * Create a mock Request object for testing.
 */
function createMockRequest(): Request {
  return new Request("https://example.com/api/test", {
    headers: new Headers({ cookie: "session=abc123" }),
  });
}

describe("lib/ratelimit/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Date.now for consistent test timing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-16T12:00:00Z"));
    // Default: no session, no IP
    mockGetSession.mockResolvedValue(null);
    mockIpAddress.mockReturnValue(null);
    // Default: rate limiter returns mock with limit function
    mockGetRateLimiter.mockReturnValue({ limit: mockLimit });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRateLimit", () => {
    describe("identifier resolution", () => {
      it("prefers user ID over IP address when authenticated", async () => {
        mockGetSession.mockResolvedValueOnce({
          user: { id: "user-123", name: "Test", email: "test@example.com" },
        });
        mockIpAddress.mockReturnValue("192.168.1.1");
        mockLimit.mockResolvedValueOnce({
          success: true,
          limit: 60,
          remaining: 55,
          reset: Date.now() + 60000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        await checkRateLimit(request);

        expect(mockLimit).toHaveBeenCalledWith("user-123");
      });

      it("falls back to IP address when not authenticated", async () => {
        mockGetSession.mockResolvedValueOnce(null);
        mockIpAddress.mockReturnValue("192.168.1.1");
        mockLimit.mockResolvedValueOnce({
          success: true,
          limit: 60,
          remaining: 55,
          reset: Date.now() + 60000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        await checkRateLimit(request);

        expect(mockLimit).toHaveBeenCalledWith("192.168.1.1");
      });

      it("falls back to IP address when auth throws error", async () => {
        mockGetSession.mockRejectedValueOnce(new Error("Auth error"));
        mockIpAddress.mockReturnValue("10.0.0.1");
        mockLimit.mockResolvedValueOnce({
          success: true,
          limit: 60,
          remaining: 55,
          reset: Date.now() + 60000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        await checkRateLimit(request);

        expect(mockLimit).toHaveBeenCalledWith("10.0.0.1");
      });

      it("allows request without rate limiting when no identifier available (fail-open)", async () => {
        mockGetSession.mockResolvedValueOnce(null);
        mockIpAddress.mockReturnValue(null);

        const request = createMockRequest();
        const result = await checkRateLimit(request);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.headers).toBeUndefined();
        }
        expect(mockLimit).not.toHaveBeenCalled();
      });
    });

    describe("rate limit responses", () => {
      it("allows request when under rate limit and returns headers", async () => {
        mockIpAddress.mockReturnValue("192.168.1.1");
        mockLimit.mockResolvedValueOnce({
          success: true,
          limit: 60,
          remaining: 55,
          reset: Date.now() + 60000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        const result = await checkRateLimit(request);

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
      });

      it("returns 429 response when rate limit exceeded", async () => {
        mockIpAddress.mockReturnValue("192.168.1.1");
        const resetTime = Date.now() + 30000; // 30s from now
        mockLimit.mockResolvedValueOnce({
          success: false,
          limit: 60,
          remaining: 0,
          reset: resetTime,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        const result = await checkRateLimit(request);

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
        mockIpAddress.mockReturnValue("10.0.0.1");
        mockLimit.mockResolvedValueOnce({
          success: true, // Still allowed (last request before limit)
          limit: 60,
          remaining: 0,
          reset: Date.now() + 45000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        const result = await checkRateLimit(request);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.info?.remaining).toBe(0);
        }
      });

      it("accepts custom rate limit config", async () => {
        mockIpAddress.mockReturnValue("192.168.1.1");
        mockLimit.mockResolvedValueOnce({
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
          pending: Promise.resolve(),
        });

        const request = createMockRequest();
        const result = await checkRateLimit(request, {
          requests: 10,
          window: "1 m",
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.info?.limit).toBe(10);
        }
      });
    });
  });
});
