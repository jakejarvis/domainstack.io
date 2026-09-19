/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedDns: vi.fn<(domain: string) => Promise<unknown>>(),
  getCachedHeaders: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchDns: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchHeaders: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchCertificates: vi.fn<(domain: string) => Promise<unknown>>(),
  enforceRateLimit: vi.fn<(args: unknown) => Promise<unknown>>(),
}));

vi.mock("@domainstack/logger", () => ({
  createLogger: () => ({
    debug: vi.fn<() => void>(),
    info: vi.fn<() => void>(),
    warn: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
  }),
}));
vi.mock("@domainstack/db/queries/dns", () => ({ getCachedDns: mocks.getCachedDns }));
vi.mock("@domainstack/db/queries/headers", () => ({ getCachedHeaders: mocks.getCachedHeaders }));
vi.mock("./dns", () => ({ fetchDns: mocks.fetchDns }));
vi.mock("./certificates", () => ({ fetchCertificates: mocks.fetchCertificates }));
vi.mock("./headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./headers")>()),
  fetchHeaders: mocks.fetchHeaders,
}));
vi.mock("@domainstack/redis/enforce", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/redis/enforce")>()),
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { RateLimitError } from "@domainstack/redis/enforce";

import { RemoteDataUnavailableError } from "./fetch-errors";
import { fetchSection, lookupSection } from "./lookup";

const DNS_DATA = { records: [], resolver: "cloudflare" };
const notCached = { data: null, stale: false, fetchedAt: null, expiresAt: null };

describe("lookupSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.getCachedDns.mockResolvedValue(notCached);
  });

  it("serves a fresh cache hit without metering or fetching", async () => {
    mocks.getCachedDns.mockResolvedValue({ ...notCached, data: DNS_DATA });

    await expect(lookupSection("dns", "example.com", { identifier: "1.2.3.4" })).resolves.toEqual({
      success: true,
      cached: true,
      data: DNS_DATA,
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.fetchDns).not.toHaveBeenCalled();
  });

  it("meters the section's limit for the identifier, then fetches, on a miss", async () => {
    mocks.fetchDns.mockResolvedValue({ success: true, data: DNS_DATA });

    await expect(lookupSection("dns", "example.com", { identifier: "1.2.3.4" })).resolves.toEqual({
      success: true,
      cached: false,
      data: DNS_DATA,
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      key: "lookup.dns",
      identifier: "1.2.3.4",
      config: { requests: 60, window: "1 m" },
    });
    expect(mocks.fetchDns).toHaveBeenCalledWith("example.com");
  });

  it("treats a stale cache entry as a miss", async () => {
    mocks.getCachedDns.mockResolvedValue({ ...notCached, data: DNS_DATA, stale: true });
    mocks.fetchDns.mockResolvedValue({ success: true, data: DNS_DATA });

    await expect(lookupSection("dns", "example.com")).resolves.toMatchObject({ cached: false });
    expect(mocks.enforceRateLimit).toHaveBeenCalledOnce();
  });

  it("propagates a rate-limit rejection without fetching", async () => {
    const limited = new RateLimitError(30, { limit: 60, remaining: 0, reset: Date.now() + 30_000 });
    mocks.enforceRateLimit.mockRejectedValue(limited);

    await expect(lookupSection("dns", "example.com", { identifier: "1.2.3.4" })).rejects.toBe(
      limited,
    );
    expect(mocks.fetchDns).not.toHaveBeenCalled();
  });

  it("passes a typed service failure through", async () => {
    mocks.fetchHeaders.mockResolvedValue({ success: false, error: "tls_error" });
    mocks.getCachedHeaders.mockResolvedValue(notCached);

    await expect(lookupSection("headers", "example.com")).resolves.toEqual({
      success: false,
      error: "tls_error",
    });
  });

  it.each([
    ["an unexpected error", new Error("boom")],
    ["a remote-unavailable error", new RemoteDataUnavailableError("down")],
  ])("maps %s to fetch_failed", async (_label, err) => {
    mocks.fetchDns.mockRejectedValue(err);

    await expect(lookupSection("dns", "example.com")).resolves.toEqual({
      success: false,
      error: "fetch_failed",
    });
  });

  it("does not swallow cache-read failures", async () => {
    mocks.getCachedDns.mockRejectedValue(new Error("db down"));

    await expect(lookupSection("dns", "example.com")).rejects.toThrow("db down");
  });

  it("attaches the status reason phrase to cached headers", async () => {
    mocks.getCachedHeaders.mockResolvedValue({
      ...notCached,
      data: { headers: [], status: 404, statusMessage: undefined },
    });

    await expect(lookupSection("headers", "example.com")).resolves.toMatchObject({
      success: true,
      cached: true,
      data: { status: 404, statusMessage: "Not Found" },
    });
  });
});

describe("fetchSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches without touching the cache or the rate limit", async () => {
    mocks.fetchCertificates.mockResolvedValue({ success: false, error: "dns_error" });

    await expect(fetchSection("certificates", "example.com")).resolves.toEqual({
      success: false,
      error: "dns_error",
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.getCachedDns).not.toHaveBeenCalled();
  });

  it("lets transient failures throw", async () => {
    mocks.fetchDns.mockRejectedValue(new RemoteDataUnavailableError("down"));

    await expect(fetchSection("dns", "example.com")).rejects.toBeInstanceOf(
      RemoteDataUnavailableError,
    );
  });
});
