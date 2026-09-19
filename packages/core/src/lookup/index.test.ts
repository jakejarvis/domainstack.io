/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedDns: vi.fn<(domain: string) => Promise<unknown>>(),
  getCachedHeaders: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchDns: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchHeaders: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchCertificates: vi.fn<(domain: string) => Promise<unknown>>(),
  enforceRateLimit: vi.fn<(args: unknown) => Promise<unknown>>(),
  updateLastAccessed: vi.fn<(domain: string) => Promise<boolean>>(),
  waitUntil: vi.fn<(work: Promise<unknown>) => void>(),
  getFavicon: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchFavicon: vi.fn<(domain: string) => Promise<unknown>>(),
  getProviderById: vi.fn<(id: string) => Promise<unknown>>(),
  getProviderLogo: vi.fn<(id: string) => Promise<unknown>>(),
  fetchProviderLogo: vi.fn<(id: string, domain: string) => Promise<unknown>>(),
}));

vi.mock("@domainstack/logger", () => ({
  createLogger: () => ({
    debug: vi.fn<() => void>(),
    info: vi.fn<() => void>(),
    warn: vi.fn<() => void>(),
    error: vi.fn<() => void>(),
  }),
}));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));
vi.mock("@domainstack/db/queries/domains", () => ({
  updateLastAccessed: mocks.updateLastAccessed,
}));
vi.mock("@domainstack/db/queries/favicons", () => ({ getFavicon: mocks.getFavicon }));
vi.mock("@domainstack/db/queries/providers", () => ({ getProviderById: mocks.getProviderById }));
vi.mock("@domainstack/db/queries/provider-logos", () => ({
  getProviderLogo: mocks.getProviderLogo,
}));
vi.mock("../favicon", () => ({ fetchFavicon: mocks.fetchFavicon }));
vi.mock("../provider-logo", () => ({ fetchProviderLogo: mocks.fetchProviderLogo }));
vi.mock("@domainstack/db/queries/dns", () => ({ getCachedDns: mocks.getCachedDns }));
vi.mock("@domainstack/db/queries/headers", () => ({ getCachedHeaders: mocks.getCachedHeaders }));
vi.mock("../dns", () => ({ fetchDns: mocks.fetchDns }));
vi.mock("../tls", () => ({ fetchCertificates: mocks.fetchCertificates }));
vi.mock("../headers", () => ({ fetchHeaders: mocks.fetchHeaders }));
vi.mock("@domainstack/redis/enforce", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/redis/enforce")>()),
  enforceRateLimit: mocks.enforceRateLimit,
}));

import { RateLimitError } from "@domainstack/redis/enforce";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";
import { fetchSection, lookupFavicon, lookupProviderLogo, lookupSection } from "./index";

const DNS_DATA = { records: [], resolver: "cloudflare" };
const notCached = { data: null, stale: false, fetchedAt: null, expiresAt: null };

describe("lookupSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.updateLastAccessed.mockResolvedValue(true);
    mocks.getCachedDns.mockResolvedValue(notCached);
  });

  it("records the access whether or not the cache answers", async () => {
    mocks.getCachedDns.mockResolvedValue({ ...notCached, data: DNS_DATA });
    await lookupSection("dns", "example.com");

    mocks.getCachedDns.mockResolvedValue(notCached);
    mocks.fetchDns.mockResolvedValue({ success: true, data: DNS_DATA });
    await lookupSection("dns", "example.com");

    expect(mocks.updateLastAccessed).toHaveBeenCalledTimes(2);
    expect(mocks.updateLastAccessed).toHaveBeenCalledWith("example.com");
    expect(mocks.waitUntil).toHaveBeenCalledTimes(2);
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
    expect(mocks.updateLastAccessed).not.toHaveBeenCalled();
  });

  it("lets transient failures throw", async () => {
    mocks.fetchDns.mockRejectedValue(new RemoteDataUnavailableError("down"));

    await expect(fetchSection("dns", "example.com")).rejects.toBeInstanceOf(
      RemoteDataUnavailableError,
    );
  });
});

const ICON = { url: "https://example.com/favicon.ico" };

describe("lookupFavicon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.getFavicon.mockResolvedValue(notCached);
  });

  it("serves a fresh hit without metering, and does not record access", async () => {
    mocks.getFavicon.mockResolvedValue({ ...notCached, data: ICON });

    await expect(lookupFavicon("example.com", { identifier: "1.2.3.4" })).resolves.toEqual({
      success: true,
      cached: true,
      data: ICON,
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.updateLastAccessed).not.toHaveBeenCalled();
  });

  it("meters the favicon limit, then fetches, on a miss", async () => {
    mocks.fetchFavicon.mockResolvedValue({ success: true, data: ICON });

    await expect(lookupFavicon("example.com", { identifier: "1.2.3.4" })).resolves.toEqual({
      success: true,
      cached: false,
      data: ICON,
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      key: "lookup.favicon",
      identifier: "1.2.3.4",
      config: { requests: 100, window: "1 m" },
    });
  });

  it("maps a remote failure to fetch_failed", async () => {
    mocks.fetchFavicon.mockRejectedValue(new RemoteDataUnavailableError("down"));

    await expect(lookupFavicon("example.com")).resolves.toEqual({
      success: false,
      error: "fetch_failed",
    });
  });
});

describe("lookupProviderLogo", () => {
  const PROVIDER_ID = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.getProviderById.mockResolvedValue({ id: PROVIDER_ID, domain: "provider.example" });
    mocks.getProviderLogo.mockResolvedValue(notCached);
  });

  it("fails without metering when the provider has no domain", async () => {
    mocks.getProviderById.mockResolvedValue({ id: PROVIDER_ID, domain: null });

    await expect(lookupProviderLogo(PROVIDER_ID, { identifier: "1.2.3.4" })).resolves.toEqual({
      success: false,
      error: "fetch_failed",
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.fetchProviderLogo).not.toHaveBeenCalled();
  });

  it("serves a fresh hit without metering", async () => {
    mocks.getProviderLogo.mockResolvedValue({ ...notCached, data: ICON });

    await expect(lookupProviderLogo(PROVIDER_ID)).resolves.toEqual({
      success: true,
      cached: true,
      data: ICON,
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("meters the provider-logo limit, then fetches with the provider's domain", async () => {
    mocks.fetchProviderLogo.mockResolvedValue({ success: true, data: ICON });

    await expect(lookupProviderLogo(PROVIDER_ID, { identifier: "1.2.3.4" })).resolves.toEqual({
      success: true,
      cached: false,
      data: ICON,
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      key: "lookup.providerLogo",
      identifier: "1.2.3.4",
      config: { requests: 60, window: "1 m" },
    });
    expect(mocks.fetchProviderLogo).toHaveBeenCalledWith(PROVIDER_ID, "provider.example");
  });
});
