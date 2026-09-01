/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit, mockGetRateLimiter, mockWaitUntil } = vi.hoisted(() => {
  type RateLimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<void>;
  };

  const limitMock = vi.fn<(identifier: string) => Promise<RateLimitResult>>();
  const getRateLimiterMock = vi.fn<(...args: unknown[]) => { limit: typeof limitMock } | null>();
  const waitUntilMock = vi.fn<(promise: Promise<unknown>) => void>();

  return {
    mockLimit: limitMock,
    mockGetRateLimiter: getRateLimiterMock,
    mockWaitUntil: waitUntilMock,
  };
});

vi.mock("@domainstack/redis/ratelimit", () => ({
  getRateLimiter: mockGetRateLimiter,
  DEFAULT_RATE_LIMIT: { requests: 60, window: "1 m" },
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: mockWaitUntil,
  ipAddress: vi.fn<(request: Request) => string | undefined>(),
}));

import type { Context } from "../context";
import { enforceRateLimit } from "./rate-limit";

const PATH = "domain.getFavicon";

function createCtx(overrides: Partial<Context> = {}): Context {
  return {
    req: undefined,
    ip: "127.0.0.1",
    session: null,
    ...overrides,
  };
}

function allowLimit(overrides: { limit?: number; remaining?: number; reset?: number } = {}) {
  const pending = Promise.resolve();
  const result = {
    success: true as const,
    limit: overrides.limit ?? 100,
    remaining: overrides.remaining ?? 99,
    reset: overrides.reset ?? Date.now() + 60_000,
    pending,
  };
  mockLimit.mockResolvedValueOnce(result);
  return result;
}

describe("enforceRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-16T12:00:00Z"));
    mockGetRateLimiter.mockReturnValue({ limit: mockLimit });
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("skips the limiter when skipRateLimit is set", async () => {
    const info = await enforceRateLimit({
      ctx: createCtx(),
      meta: { skipRateLimit: true, rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(info).toBeUndefined();
    expect(mockGetRateLimiter).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("skips the limiter in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const info = await enforceRateLimit({
      ctx: createCtx(),
      meta: { rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(info).toBeUndefined();
    expect(mockGetRateLimiter).not.toHaveBeenCalled();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("fails open when no limiter is available", async () => {
    mockGetRateLimiter.mockReturnValueOnce(null);

    const info = await enforceRateLimit({
      ctx: createCtx(),
      meta: { rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(info).toBeUndefined();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("fails open when no identifier is available", async () => {
    const info = await enforceRateLimit({
      ctx: createCtx({ ip: null, session: null }),
      meta: { rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(info).toBeUndefined();
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("fails open when Redis throws", async () => {
    mockLimit.mockRejectedValueOnce(new Error("Redis connection error"));

    const info = await enforceRateLimit({
      ctx: createCtx(),
      meta: { rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(info).toBeUndefined();
    expect(mockWaitUntil).not.toHaveBeenCalled();
  });

  it("prefers user ID over IP and returns RateLimitInfo on success", async () => {
    const allowed = allowLimit({ limit: 100, remaining: 42 });

    const info = await enforceRateLimit({
      ctx: createCtx({
        ip: "192.168.1.1",
        session: { user: { id: "user-123", name: "Test", email: "test@example.com" } },
      }),
      meta: { rateLimit: { requests: 100, window: "1 m" } },
      path: PATH,
    });

    expect(mockGetRateLimiter).toHaveBeenCalledWith({ requests: 100, window: "1 m" });
    expect(mockLimit).toHaveBeenCalledWith("domain.getFavicon:user-123");
    expect(mockWaitUntil).toHaveBeenCalledWith(allowed.pending);
    expect(info).toEqual({
      limit: 100,
      remaining: 42,
      reset: allowed.reset,
    });
  });

  it("falls back to IP for anonymous requests", async () => {
    allowLimit();

    await enforceRateLimit({
      ctx: createCtx({ ip: "10.0.0.1" }),
      meta: { rateLimit: { requests: 60, window: "1 m" } },
      path: PATH,
    });

    expect(mockLimit).toHaveBeenCalledWith("domain.getFavicon:10.0.0.1");
  });

  it("uses default limits when meta.rateLimit is omitted", async () => {
    allowLimit();

    await enforceRateLimit({
      ctx: createCtx(),
      meta: undefined,
      path: PATH,
    });

    expect(mockGetRateLimiter).toHaveBeenCalledWith({ requests: 60, window: "1 m" });
  });

  it("throws TOO_MANY_REQUESTS with retry timing when the limit is exceeded", async () => {
    const pending = Promise.resolve();
    const reset = Date.now() + 30_000;
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset,
      pending,
    });

    await expect(
      enforceRateLimit({
        ctx: createCtx(),
        meta: { rateLimit: { requests: 100, window: "1 m" } },
        path: PATH,
      }),
    ).rejects.toMatchObject({
      name: "TRPCError",
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again in 30s",
      cause: {
        retryAfter: 30,
        rateLimit: { limit: 100, remaining: 0, reset },
      },
    });

    expect(mockWaitUntil).toHaveBeenCalledWith(pending);
  });
});
