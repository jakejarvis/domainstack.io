/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetRateLimiter } = vi.hoisted(() => {
  const getRateLimiterMock =
    vi.fn<(...args: unknown[]) => { limit: () => Promise<unknown> } | null>();

  return {
    mockGetRateLimiter: getRateLimiterMock,
  };
});

vi.mock("@domainstack/redis/ratelimit", () => ({
  getRateLimiter: mockGetRateLimiter,
  DEFAULT_RATE_LIMIT: { requests: 60, window: "1 m" },
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn<(promise: Promise<unknown>) => void>(),
  ipAddress: vi.fn<(request: Request) => string | undefined>(),
}));

import type { Context } from "../context";
import { t } from "../trpc";
import { withRateLimit } from "./rate-limit";

function createCtx(overrides: Partial<Context> = {}): Context {
  return {
    req: undefined,
    ip: "127.0.0.1",
    session: null,
    ...overrides,
  };
}

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips the limiter when rateLimit is false", async () => {
    const router = t.router({
      ping: t.procedure
        .use(withRateLimit)
        .meta({ rateLimit: false })
        .query(() => "ok"),
    });
    const caller = t.createCallerFactory(router)(createCtx());

    await expect(caller.ping()).resolves.toBe("ok");
    expect(mockGetRateLimiter).not.toHaveBeenCalled();
  });
});
