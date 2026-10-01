/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "../lib/fetch-errors";

const mocks = vi.hoisted(() => ({
  fetchDns: vi.fn<(domain: string) => Promise<unknown>>(),
  fetchHeaders: vi.fn<(domain: string) => Promise<unknown>>(),
  lookupGeoIp: vi.fn<(ip: string) => Promise<unknown>>(),
  getProviderCatalog: vi.fn<() => Promise<unknown>>(),
  ensureDomainRecord: vi.fn<(domain: string) => Promise<{ id: string }>>(),
  upsertHosting: vi.fn<(row: HostingRow) => Promise<void>>(),
  upsertCatalogProvider: vi.fn<(provider: unknown) => Promise<{ id: string }>>(),
  resolveOrCreateProviderId: vi.fn<(input: unknown) => Promise<string>>(),
}));

interface HostingRow {
  expiresAt: Date;
  fetchedAt: Date;
}

vi.mock("../dns", () => ({ fetchDns: mocks.fetchDns }));
vi.mock("../headers", () => ({ fetchHeaders: mocks.fetchHeaders }));
vi.mock("./geoip", () => ({ lookupGeoIp: mocks.lookupGeoIp }));
vi.mock("@domainstack/edge-config", () => ({ getProviderCatalog: mocks.getProviderCatalog }));
vi.mock("@domainstack/db/queries/domains", () => ({
  ensureDomainRecord: mocks.ensureDomainRecord,
}));
vi.mock("@domainstack/db/queries/hosting", () => ({ upsertHosting: mocks.upsertHosting }));
vi.mock("@domainstack/db/queries/providers", () => ({
  upsertCatalogProvider: mocks.upsertCatalogProvider,
  resolveOrCreateProviderId: mocks.resolveOrCreateProviderId,
}));

import { fetchHosting } from "./index";

const DOMAIN = "example.com";
const NOW = new Date("2024-01-01T00:00:00.000Z");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

const catalog = {
  hosting: [
    {
      name: "Vercel",
      domain: "vercel.com",
      rule: { kind: "headerPresent", name: "x-vercel-id" },
    },
  ],
  email: [],
  dns: [],
  ca: [],
  registrar: [],
};

const GEO = {
  geo: {
    city: "Ashburn",
    region: "Virginia",
    country: "United States",
    country_code: "US",
    lat: 1,
    lon: 2,
  },
  owner: "Amazon.com, Inc.",
  domain: "amazon.com",
};

function dnsResult(records: Array<{ type: string; value: string }>) {
  return {
    success: true,
    data: { records: records.map((r) => ({ ...r, name: DOMAIN, ttl: 300 })) },
  };
}

function headersOk() {
  return { success: true, data: { headers: [{ name: "x-vercel-id", value: "iad1::abc" }] } };
}

function expiresInMs(): number {
  expect(mocks.upsertHosting).toHaveBeenCalledTimes(1);
  const row = mocks.upsertHosting.mock.calls[0]?.[0];
  return (row?.expiresAt.getTime() ?? 0) - NOW.getTime();
}

describe("fetchHosting TTL", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mocks.fetchDns.mockResolvedValue(dnsResult([{ type: "A", value: "93.184.216.34" }]));
    mocks.fetchHeaders.mockResolvedValue(headersOk());
    mocks.lookupGeoIp.mockResolvedValue(GEO);
    mocks.getProviderCatalog.mockResolvedValue(catalog);
    mocks.ensureDomainRecord.mockResolvedValue({ id: "domain-1" });
    mocks.upsertHosting.mockResolvedValue(undefined);
    mocks.upsertCatalogProvider.mockResolvedValue({ id: "provider-catalog" });
    mocks.resolveOrCreateProviderId.mockResolvedValue("provider-discovered");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caches for 24h when headers and GeoIP both succeed", async () => {
    const res = await fetchHosting(DOMAIN);
    expect(res.data.hostingProvider.name).toBe("Vercel");
    expect(expiresInMs()).toBe(ONE_DAY_MS);
  });

  it("retries in 15m when the headers fetch fails transiently", async () => {
    mocks.fetchHeaders.mockRejectedValue(new Error("timeout"));
    const res = await fetchHosting(DOMAIN);
    // Best-effort result is still returned (IP owner fallback)
    expect(res.data.hostingProvider.name).toBe("Amazon.com, Inc.");
    expect(expiresInMs()).toBe(RETRY_MS);
  });

  it("caches for 24h when headers fail permanently", async () => {
    mocks.fetchHeaders.mockResolvedValue({ success: false, error: "tls_error" });
    await fetchHosting(DOMAIN);
    expect(expiresInMs()).toBe(ONE_DAY_MS);
  });

  it("retries in 15m when the GeoIP provider is unavailable", async () => {
    mocks.lookupGeoIp.mockRejectedValue(new RemoteDataUnavailableError("GeoIP lookup unavailable"));
    const res = await fetchHosting(DOMAIN);
    expect(res.data.geo).toBeNull();
    expect(expiresInMs()).toBe(RETRY_MS);
  });

  it("returns no location when GeoIP has none, and still persists", async () => {
    const emptyGeo = { city: "", region: "", country: "", country_code: "", lat: null, lon: null };
    mocks.lookupGeoIp.mockResolvedValue({ ...GEO, geo: emptyGeo });
    const res = await fetchHosting(DOMAIN);
    // getCachedHosting reads an all-empty location back as null; a fresh lookup must agree.
    expect(res.data.geo).toBeNull();
    expect(mocks.upsertHosting).toHaveBeenCalledTimes(1);
  });

  it("returns the location when GeoIP has only a country", async () => {
    const countryOnly = {
      ...GEO.geo,
      city: "",
      region: "",
      country_code: "",
      lat: null,
      lon: null,
    };
    mocks.lookupGeoIp.mockResolvedValue({ ...GEO, geo: countryOnly });
    const res = await fetchHosting(DOMAIN);
    expect(res.data.geo).toEqual(countryOnly);
  });

  it("rethrows unexpected GeoIP errors without persisting", async () => {
    mocks.lookupGeoIp.mockRejectedValue(new Error("boom"));
    await expect(fetchHosting(DOMAIN)).rejects.toThrow("boom");
    expect(mocks.upsertHosting).not.toHaveBeenCalled();
  });

  it("caches for 24h without an address, and skips GeoIP", async () => {
    mocks.fetchDns.mockResolvedValue(dnsResult([]));
    mocks.fetchHeaders.mockRejectedValue(new Error("timeout"));
    await fetchHosting(DOMAIN);
    expect(mocks.lookupGeoIp).not.toHaveBeenCalled();
    expect(expiresInMs()).toBe(ONE_DAY_MS);
  });

  it("fails without persisting when the provider catalog is unavailable", async () => {
    mocks.getProviderCatalog.mockRejectedValue(new Error("Provider catalog unavailable"));
    await expect(fetchHosting(DOMAIN)).rejects.toThrow("Provider catalog unavailable");
    expect(mocks.upsertHosting).not.toHaveBeenCalled();
  });
});
