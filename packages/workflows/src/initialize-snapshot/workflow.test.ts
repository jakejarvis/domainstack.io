/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DnsFetchData } from "@domainstack/core/dns/types";

// Hoisted mocks for every module the workflow imports (dynamically or statically).
const registrationMock = vi.hoisted(() => ({
  lookupWhoisStep: vi.fn<typeof import("../steps/registration").lookupWhoisStep>(),
  normalizeAndBuildResponseStep:
    vi.fn<typeof import("../steps/registration").normalizeAndBuildResponseStep>(),
  persistRegistrationStep: vi.fn<typeof import("../steps/registration").persistRegistrationStep>(),
}));

const dnsMock = vi.hoisted(() => ({
  fetchDnsRecordsStep: vi.fn<typeof import("../steps/dns").fetchDnsRecordsStep>(),
  persistDnsRecordsStep: vi.fn<typeof import("../steps/dns").persistDnsRecordsStep>(),
}));

const headersMock = vi.hoisted(() => ({
  fetchHeadersStep: vi.fn<typeof import("../steps/headers").fetchHeadersStep>(),
  persistHeadersStep: vi.fn<typeof import("../steps/headers").persistHeadersStep>(),
}));

const certificatesMock = vi.hoisted(() => ({
  fetchCertificateChainStep:
    vi.fn<typeof import("../steps/certificates").fetchCertificateChainStep>(),
  processChainStep: vi.fn<typeof import("../steps/certificates").processChainStep>(),
  persistCertificatesStep: vi.fn<typeof import("../steps/certificates").persistCertificatesStep>(),
}));

const hostingMock = vi.hoisted(() => ({
  lookupGeoIpStep: vi.fn<typeof import("../steps/hosting").lookupGeoIpStep>(),
  persistHostingStep: vi.fn<typeof import("../steps/hosting").persistHostingStep>(),
  detectAndResolveProvidersStep:
    vi.fn<typeof import("../steps/hosting").detectAndResolveProvidersStep>(),
}));

const domainsMock = vi.hoisted(() => ({
  getDomainNameById: vi.fn<typeof import("@domainstack/db/queries/domains").getDomainNameById>(),
}));

const snapshotsMock = vi.hoisted(() => ({
  createSnapshot: vi.fn<typeof import("@domainstack/db/queries/snapshots").createSnapshot>(),
}));

vi.mock("../steps/registration", () => registrationMock);
vi.mock("../steps/dns", () => dnsMock);
vi.mock("../steps/headers", () => headersMock);
vi.mock("../steps/certificates", () => certificatesMock);
vi.mock("../steps/hosting", () => hostingMock);
vi.mock("@domainstack/db/queries/domains", () => domainsMock);
vi.mock("@domainstack/db/queries/snapshots", () => snapshotsMock);

const DNS_RESULT: DnsFetchData = {
  records: [{ type: "A", name: "example.com", value: "192.0.2.1", ttl: 300 }] as never,
  resolver: "cloudflare",
  recordsWithExpiry: [],
};

const EMPTY_DNS_RESULT: DnsFetchData = {
  records: [],
  resolver: "cloudflare",
  recordsWithExpiry: [],
};

const PROVIDERS = {
  dnsProvider: { id: "p-dns", name: "DNS Co" },
  hostingProvider: { id: null, name: null },
  emailProvider: { id: null, name: null },
} as never;

beforeEach(() => {
  vi.clearAllMocks();

  domainsMock.getDomainNameById.mockResolvedValue({ name: "example.com" });
  registrationMock.lookupWhoisStep.mockRejectedValue(new Error("whois unavailable"));
  headersMock.fetchHeadersStep.mockRejectedValue(new Error("headers unavailable"));
  certificatesMock.fetchCertificateChainStep.mockRejectedValue(new Error("certs unavailable"));
  dnsMock.fetchDnsRecordsStep.mockResolvedValue(DNS_RESULT);
  dnsMock.persistDnsRecordsStep.mockResolvedValue(undefined);
  hostingMock.lookupGeoIpStep.mockResolvedValue(null);
  hostingMock.persistHostingStep.mockResolvedValue(undefined);
  hostingMock.detectAndResolveProvidersStep.mockResolvedValue(PROVIDERS);
});

describe("initializeSnapshotWorkflow", () => {
  it("still creates the baseline when the DNS cache write fails", async () => {
    dnsMock.persistDnsRecordsStep.mockRejectedValue(new Error("constraint"));
    snapshotsMock.createSnapshot.mockResolvedValue({ id: "snap-1" } as never);

    const { initializeSnapshotWorkflow } = await import("./workflow");
    const result = await initializeSnapshotWorkflow({
      trackedDomainId: "td-1",
      domainId: "d-1",
    });

    expect(result).toEqual({ success: true, snapshotId: "snap-1" });
  });

  it("reports snapshot_exists without throwing when a baseline already exists", async () => {
    snapshotsMock.createSnapshot.mockResolvedValue(null);

    const { initializeSnapshotWorkflow } = await import("./workflow");
    const result = await initializeSnapshotWorkflow({
      trackedDomainId: "td-1",
      domainId: "d-1",
    });

    expect(result).toEqual({ success: false, error: "snapshot_exists" });
  });

  it("reports dns_unobserved and never calls createSnapshot when DNS resolves nothing", async () => {
    dnsMock.fetchDnsRecordsStep.mockResolvedValue(EMPTY_DNS_RESULT);

    const { initializeSnapshotWorkflow } = await import("./workflow");
    const result = await initializeSnapshotWorkflow({
      trackedDomainId: "td-1",
      domainId: "d-1",
    });

    expect(result).toEqual({ success: false, error: "dns_unobserved" });
    expect(snapshotsMock.createSnapshot).not.toHaveBeenCalled();
  });
});
