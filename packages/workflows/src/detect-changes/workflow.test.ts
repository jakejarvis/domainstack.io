/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANGE_CONFIRMATIONS } from "@domainstack/constants";
import type { DnsFetchData } from "@domainstack/core/dns";
import type { SnapshotForMonitoring } from "@domainstack/db/queries/snapshots";
import { providerObservationKey } from "@domainstack/utils/change-detection";

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

const notificationsMock = vi.hoisted(() => ({
  determineNotificationChannelsStep:
    vi.fn<typeof import("../steps/notifications").determineNotificationChannelsStep>(),
  resolveProviderNamesStep:
    vi.fn<typeof import("../steps/notifications").resolveProviderNamesStep>(),
  sendRegistrationChangeNotificationStep:
    vi.fn<typeof import("../steps/notifications").sendRegistrationChangeNotificationStep>(),
  sendProviderChangeNotificationStep:
    vi.fn<typeof import("../steps/notifications").sendProviderChangeNotificationStep>(),
  sendCertificateChangeNotificationStep:
    vi.fn<typeof import("../steps/notifications").sendCertificateChangeNotificationStep>(),
}));

const snapshotsMock = vi.hoisted(() => ({
  getSnapshot: vi.fn<typeof import("@domainstack/db/queries/snapshots").getSnapshot>(),
  updateSnapshot: vi.fn<typeof import("@domainstack/db/queries/snapshots").updateSnapshot>(),
}));

const monitorDedupMock = vi.hoisted(() => ({
  releaseMonitorLock: vi.fn<typeof import("../lib/monitor-lock").releaseMonitorLock>(),
}));

vi.mock("../steps/registration", () => registrationMock);
vi.mock("../steps/dns", () => dnsMock);
vi.mock("../steps/headers", () => headersMock);
vi.mock("../steps/certificates", () => certificatesMock);
vi.mock("../steps/hosting", () => hostingMock);
vi.mock("../steps/notifications", () => notificationsMock);
vi.mock("@domainstack/db/queries/snapshots", () => snapshotsMock);
vi.mock("../lib/monitor-lock", () => monitorDedupMock);

const DNS_RESULT: DnsFetchData = {
  records: [{ type: "A", name: "example.com", value: "192.0.2.1", ttl: 300 }] as never,
  resolver: "cloudflare",
  recordsWithExpiry: [],
};

const PROVIDERS = {
  dnsProvider: { id: "p-dns", name: "DNS Co" },
  hostingProvider: { id: null, name: null },
  emailProvider: { id: null, name: null },
} as never;

/**
 * Baseline snapshot whose state matches the mocked observations above, so
 * detection finds no change in any branch. Plan 027 reuses this helper.
 */
export function makeSnapshot(
  overrides: Partial<SnapshotForMonitoring> = {},
): SnapshotForMonitoring {
  return {
    id: "snap-1",
    trackedDomainId: "td-1",
    userId: "u1",
    domainId: "d1",
    domainName: "example.com",
    registration: {
      registrarProviderId: null,
      nameservers: [],
      transferLock: null,
      statuses: [],
    },
    certificate: {
      caProviderId: null,
      issuer: "",
      validTo: "",
      fingerprint: null,
      serialNumber: null,
    },
    dnsProviderId: "p-dns",
    hostingProviderId: null,
    emailProviderId: null,
    providerPending: null,
    userEmail: "a@example.com",
    userName: "Alex",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  snapshotsMock.getSnapshot.mockResolvedValue(makeSnapshot());
  snapshotsMock.updateSnapshot.mockResolvedValue(null);
  monitorDedupMock.releaseMonitorLock.mockResolvedValue(undefined);

  registrationMock.lookupWhoisStep.mockRejectedValue(new Error("whois unavailable"));
  headersMock.fetchHeadersStep.mockRejectedValue(new Error("headers unavailable"));
  certificatesMock.fetchCertificateChainStep.mockRejectedValue(new Error("certs unavailable"));
  dnsMock.fetchDnsRecordsStep.mockResolvedValue(DNS_RESULT);
  dnsMock.persistDnsRecordsStep.mockResolvedValue(undefined);
  hostingMock.lookupGeoIpStep.mockResolvedValue(null);
  hostingMock.persistHostingStep.mockResolvedValue(undefined);
  hostingMock.detectAndResolveProvidersStep.mockResolvedValue(PROVIDERS);
  notificationsMock.determineNotificationChannelsStep.mockResolvedValue({
    shouldSendEmail: true,
    shouldSendInApp: true,
  });
  notificationsMock.resolveProviderNamesStep.mockResolvedValue(new Map());
});

describe("detectChangesWorkflow", () => {
  it("does not abort the run when the DNS cache write fails", async () => {
    dnsMock.persistDnsRecordsStep.mockRejectedValue(new Error("constraint"));

    const { detectChangesWorkflow } = await import("./workflow");
    const result = await detectChangesWorkflow({
      trackedDomainId: "td-1",
      monitorLockOwnerToken: "tok",
    });

    expect(result).toEqual({
      skipped: false,
      registrationChanges: false,
      providerChanges: false,
      certificateChanges: false,
    });
    expect(monitorDedupMock.releaseMonitorLock).toHaveBeenCalledWith("td-1", "tok");
  });

  it("skips with snapshot_not_found and still releases the lock when no snapshot exists", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(null);

    const { detectChangesWorkflow } = await import("./workflow");
    const result = await detectChangesWorkflow({
      trackedDomainId: "td-1",
      monitorLockOwnerToken: "tok",
    });

    expect(result).toEqual({
      skipped: true,
      reason: "snapshot_not_found",
      registrationChanges: false,
      providerChanges: false,
      certificateChanges: false,
    });
    expect(monitorDedupMock.releaseMonitorLock).toHaveBeenCalledWith("td-1", "tok");
  });

  it("fails the run and does not release the lock when the required DNS fetch fails", async () => {
    dnsMock.fetchDnsRecordsStep.mockRejectedValue(new Error("dns fetch failed"));

    const { detectChangesWorkflow } = await import("./workflow");

    await expect(
      detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" }),
    ).rejects.toThrow("dns fetch failed");
    expect(monitorDedupMock.releaseMonitorLock).not.toHaveBeenCalled();
  });
});

describe("change alert idempotency", () => {
  beforeEach(() => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({
        dnsProviderId: "p-old",
        providerPending: {
          key: providerObservationKey({
            dnsProviderId: "p-dns",
            hostingProviderId: null,
            emailProviderId: null,
          }),
          firstSeenAt: "2026-09-13T00:00:00.000Z",
          observations: CHANGE_CONFIRMATIONS - 1,
        },
      }),
    );
  });

  it("keys the same confirmed change with an identical idempotencyKey across runs, even when the first run fails", async () => {
    notificationsMock.sendProviderChangeNotificationStep
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce(true);

    const { detectChangesWorkflow } = await import("./workflow");

    await expect(
      detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" }),
    ).rejects.toThrow("insert failed");
    expect(snapshotsMock.updateSnapshot).not.toHaveBeenCalledWith(
      "td-1",
      expect.objectContaining({ providerPending: null }),
    );

    const result = await detectChangesWorkflow({
      trackedDomainId: "td-1",
      monitorLockOwnerToken: "tok",
    });
    expect(result.providerChanges).toBe(true);

    const expectedKey = `provider:td-1:${providerObservationKey({ dnsProviderId: "p-old", hostingProviderId: null, emailProviderId: null })}>${providerObservationKey({ dnsProviderId: "p-dns", hostingProviderId: null, emailProviderId: null })}`;
    expect(notificationsMock.sendProviderChangeNotificationStep).toHaveBeenCalledTimes(2);
    for (const call of notificationsMock.sendProviderChangeNotificationStep.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ idempotencyKey: expectedKey }));
    }
  });

  it("releases the monitor lock when a FatalError terminates the run, since nothing will retry it", async () => {
    const { FatalError } = await import("workflow");
    notificationsMock.sendProviderChangeNotificationStep.mockRejectedValue(
      new FatalError("failed to create notification record"),
    );

    const { detectChangesWorkflow } = await import("./workflow");

    await expect(
      detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" }),
    ).rejects.toThrow("failed to create notification record");
    expect(monitorDedupMock.releaseMonitorLock).toHaveBeenCalledWith("td-1", "tok");
  });

  it("keys a different stored provider with a different idempotencyKey", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({
        dnsProviderId: "p-older",
        providerPending: {
          key: providerObservationKey({
            dnsProviderId: "p-dns",
            hostingProviderId: null,
            emailProviderId: null,
          }),
          firstSeenAt: "2026-09-13T00:00:00.000Z",
          observations: CHANGE_CONFIRMATIONS - 1,
        },
      }),
    );
    notificationsMock.sendProviderChangeNotificationStep.mockResolvedValue(true);

    const { detectChangesWorkflow } = await import("./workflow");
    await detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });

    const expectedKey = `provider:td-1:${providerObservationKey({ dnsProviderId: "p-older", hostingProviderId: null, emailProviderId: null })}>${providerObservationKey({ dnsProviderId: "p-dns", hostingProviderId: null, emailProviderId: null })}`;
    expect(notificationsMock.sendProviderChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: expectedKey }),
      true,
      true,
    );
  });
});
