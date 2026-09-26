/* @vitest-environment node */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit:
    vi.fn<
      (
        request: Request,
        config?: unknown,
      ) => Promise<{ success: true; headers?: unknown } | { success: false; error: Response }>
    >(),
  createCaller: vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@/lib/ratelimit/api", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@domainstack/api", () => ({
  createCaller: mocks.createCaller,
}));

import { GET } from "./route";

function makeRequest(url: string): NextRequest {
  return new NextRequest(new Request(url));
}

describe("GET /api/og", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 without calling checkRateLimit when domain is missing", async () => {
    const response = await GET(makeRequest("https://domainstack.io/api/og"));

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 400 without calling checkRateLimit when domain is invalid", async () => {
    const response = await GET(makeRequest("https://domainstack.io/api/og?domain=not a domain"));

    expect(response.status).toBe(400);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("calls checkRateLimit exactly once with the api:og:get bucket for a valid domain", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: new Response("rate limited", { status: 429 }),
    });

    await GET(makeRequest("https://domainstack.io/api/og?domain=example.com"));

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "api:og:get" }),
    );
  });

  it("accepts a subdomain hostname", async () => {
    mocks.checkRateLimit.mockResolvedValue({
      success: false,
      error: new Response("rate limited", { status: 429 }),
    });

    const response = await GET(makeRequest("https://domainstack.io/api/og?domain=api.example.com"));

    expect(response.status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it("returns the pre-built error response and skips createCaller when rate limited", async () => {
    const rateLimitError = new Response("rate limited", { status: 429 });
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: rateLimitError });

    const response = await GET(makeRequest("https://domainstack.io/api/og?domain=example.com"));

    expect(response).toBe(rateLimitError);
    expect(mocks.createCaller).not.toHaveBeenCalled();
  });
});
