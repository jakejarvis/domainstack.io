/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DnsFetchData } from "@domainstack/core/dns/types";

// Hoisted mocks for every step module observeDomain imports.
const registrationMock = vi.hoisted(() => ({
  lookupWhoisStep: vi.fn<typeof import("./registration").lookupWhoisStep>(),
  normalizeAndBuildResponseStep:
    vi.fn<typeof import("./registration").normalizeAndBuildResponseStep>(),
  persistRegistrationStep: vi.fn<typeof import("./registration").persistRegistrationStep>(),
}));

const dnsMock = vi.hoisted(() => ({
  fetchDnsRecordsStep: vi.fn<typeof import("./dns").fetchDnsRecordsStep>(),
  persistDnsRecordsStep: vi.fn<typeof import("./dns").persistDnsRecordsStep>(),
}));

const headersMock = vi.hoisted(() => ({
  fetchHeadersStep: vi.fn<typeof import("./headers").fetchHeadersStep>(),
  persistHeadersStep: vi.fn<typeof import("./headers").persistHeadersStep>(),
}));

const certificatesMock = vi.hoisted(() => ({
  fetchCertificateChainStep: vi.fn<typeof import("./certificates").fetchCertificateChainStep>(),
  processChainStep: vi.fn<typeof import("./certificates").processChainStep>(),
  persistCertificatesStep: vi.fn<typeof import("./certificates").persistCertificatesStep>(),
}));

const hostingMock = vi.hoisted(() => ({
  lookupGeoIpStep: vi.fn<typeof import("./hosting").lookupGeoIpStep>(),
  persistHostingStep: vi.fn<typeof import("./hosting").persistHostingStep>(),
  detectAndResolveProvidersStep: vi.fn<typeof import("./hosting").detectAndResolveProvidersStep>(),
}));

vi.mock("./registration", () => registrationMock);
vi.mock("./dns", () => dnsMock);
vi.mock("./headers", () => headersMock);
vi.mock("./certificates", () => certificatesMock);
vi.mock("./hosting", () => hostingMock);

import { observeDomain } from "./observe-domain";

const DOMAIN = "example.com";

const DNS_RESULT: DnsFetchData = {
  records: [{ type: "A", name: DOMAIN, value: "192.0.2.1", ttl: 300 }] as never,
  resolver: "cloudflare",
  recordsWithExpiry: [],
};

const WHOIS_RESULT = { success: true, data: { recordJson: "{}" } } as never;
const REGISTRATION = { domain: DOMAIN, isRegistered: true } as never;
const PROVIDERS = {
  dnsProvider: { id: null, name: null },
  hostingProvider: { id: null, name: null },
  emailProvider: { id: null, name: null },
} as never;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();

  registrationMock.lookupWhoisStep.mockResolvedValue(WHOIS_RESULT);
  registrationMock.normalizeAndBuildResponseStep.mockResolvedValue(REGISTRATION);
  registrationMock.persistRegistrationStep.mockResolvedValue(undefined);
  dnsMock.fetchDnsRecordsStep.mockResolvedValue(DNS_RESULT);
  dnsMock.persistDnsRecordsStep.mockResolvedValue(undefined);
  headersMock.fetchHeadersStep.mockResolvedValue({ success: true, data: { headers: [] } } as never);
  headersMock.persistHeadersStep.mockResolvedValue(undefined);
  certificatesMock.fetchCertificateChainStep.mockResolvedValue({
    success: true,
    data: { chain: [] },
  } as never);
  certificatesMock.processChainStep.mockResolvedValue({ certificates: [] } as never);
  certificatesMock.persistCertificatesStep.mockResolvedValue(undefined);
  hostingMock.lookupGeoIpStep.mockResolvedValue(null);
  hostingMock.detectAndResolveProvidersStep.mockResolvedValue(PROVIDERS);
  hostingMock.persistHostingStep.mockResolvedValue(undefined);
});

describe("observeDomain", () => {
  it("persists DNS without waiting for registration normalization", async () => {
    const normalize = deferred<never>();
    registrationMock.normalizeAndBuildResponseStep.mockReturnValue(normalize.promise);

    const run = observeDomain(DOMAIN);
    try {
      await vi.waitFor(() => expect(dnsMock.persistDnsRecordsStep).toHaveBeenCalled());
    } finally {
      // Always release the deferred and drain the run so nothing dangles.
      normalize.resolve(REGISTRATION);
      await run;
    }
  });

  it("starts GeoIP before the slow WHOIS fetch finishes", async () => {
    const whois = deferred<never>();
    registrationMock.lookupWhoisStep.mockReturnValue(whois.promise);

    const run = observeDomain(DOMAIN);
    try {
      await vi.waitFor(() => expect(hostingMock.lookupGeoIpStep).toHaveBeenCalledWith("192.0.2.1"));
    } finally {
      whois.resolve(WHOIS_RESULT);
      await run;
    }
  });

  it("a failing required normalize step still rejects, after the other chains settle", async () => {
    const error = new Error("normalize failed");
    registrationMock.normalizeAndBuildResponseStep.mockRejectedValue(error);

    await expect(observeDomain(DOMAIN)).rejects.toBe(error);
    expect(hostingMock.persistHostingStep).toHaveBeenCalled();
    expect(dnsMock.persistDnsRecordsStep).toHaveBeenCalled();
  });

  it("a failing optional persist does not fail the observation", async () => {
    hostingMock.persistHostingStep.mockRejectedValue(new Error("constraint"));

    const result = await observeDomain(DOMAIN);

    expect(result.providers).toBe(PROVIDERS);
  });

  it("returns the same shape as before", async () => {
    const result = await observeDomain(DOMAIN);

    expect(Object.keys(result).sort()).toEqual(
      [
        "registrationData",
        "dnsResult",
        "headersResult",
        "certificates",
        "ip",
        "geoResult",
        "providers",
      ].sort(),
    );
    expect(result.ip).toBe("192.0.2.1");
  });
});
