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
  cacheLife: vi.fn<(profile: string) => void>(),
  loadGoogleFont: vi.fn<() => Promise<ArrayBuffer>>(),
}));

vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
}));

vi.mock("@/lib/og-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/og-utils")>()),
  loadGoogleFont: mocks.loadGoogleFont,
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

  it("returns the pre-built error response and skips createCaller when rate limited", async () => {
    const rateLimitError = new Response("rate limited", { status: 429 });
    mocks.checkRateLimit.mockResolvedValue({ success: false, error: rateLimitError });

    const response = await GET(makeRequest("https://domainstack.io/api/og?domain=example.com"));

    expect(response).toBe(rateLimitError);
    expect(mocks.createCaller).not.toHaveBeenCalled();
  });
});

describe("GET /api/og caching", () => {
  const registration = {
    success: true,
    cached: true,
    data: { registrarProvider: { name: "Namecheap", domain: "namecheap.com" } },
  };
  const hosting = {
    success: true,
    cached: true,
    data: {
      dnsProvider: { name: "Cloudflare", domain: "cloudflare.com" },
      hostingProvider: { name: "Vercel", domain: "vercel.com" },
      emailProvider: { name: "Google Workspace", domain: "google.com" },
    },
  };
  const certificates = {
    success: true,
    cached: true,
    data: { certificates: [{ caProvider: { name: "Let's Encrypt", domain: "letsencrypt.org" } }] },
  };

  const getRegistration = vi.fn<(input: unknown) => Promise<unknown>>();
  const getHosting = vi.fn<(input: unknown) => Promise<unknown>>();
  const getCertificates = vi.fn<(input: unknown) => Promise<unknown>>();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.loadGoogleFont.mockResolvedValue(new ArrayBuffer(0));
    getRegistration.mockResolvedValue(registration);
    getHosting.mockResolvedValue(hosting);
    getCertificates.mockResolvedValue(certificates);
    mocks.createCaller.mockReturnValue({
      domain: { getRegistration, getHosting, getCertificates },
    });
  });

  async function fetchImage(): Promise<Response> {
    return GET(makeRequest("https://domainstack.io/api/og?domain=example.com"));
  }

  it("caches a complete provider stack for days at the CDN", async () => {
    const response = await fetchImage();

    expect(mocks.cacheLife).toHaveBeenCalledWith("days");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=604800");
  });

  it("caches briefly when a lookup failed transiently", async () => {
    getHosting.mockResolvedValue({ success: false, error: "fetch_failed" });

    const response = await fetchImage();

    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("public, s-maxage=300");
  });

  it("still caches for days when a lookup failed permanently", async () => {
    getCertificates.mockResolvedValue({ success: false, error: "tls_error" });

    const response = await fetchImage();

    expect(mocks.cacheLife).toHaveBeenCalledWith("days");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain("s-maxage=604800");
  });
});
