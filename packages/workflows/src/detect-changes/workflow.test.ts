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
  sendDnssecChangeNotificationStep:
    vi.fn<typeof import("../steps/notifications").sendDnssecChangeNotificationStep>(),
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
  dnssec: { status: "insecure", ds: [], dnskeys: [] },
  dnssecExpiresAt: "2030-01-01T00:00:00.000Z",
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
    dnssec: { status: "insecure", pending: null },
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
      dnssecChanges: false,
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
      dnssecChanges: false,
    });
    expect(monitorDedupMock.releaseMonitorLock).toHaveBeenCalledWith("td-1", "tok");
  });

  it("releases the lock when fetching the snapshot fails fatally", async () => {
    const { FatalError } = await import("workflow");
    snapshotsMock.getSnapshot.mockRejectedValue(new FatalError("snapshot unavailable"));

    const { detectChangesWorkflow } = await import("./workflow");

    await expect(
      detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" }),
    ).rejects.toThrow("snapshot unavailable");
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

describe("DNSSEC change monitoring", () => {
  const dnssecResult = (status: "secure" | "insecure" | "bogus" | "indeterminate") =>
    dnsMock.fetchDnsRecordsStep.mockResolvedValue({
      ...DNS_RESULT,
      dnssec: { status, ds: [], dnskeys: [] },
    });

  const pending = (key: string, observations = CHANGE_CONFIRMATIONS - 1) => ({
    key,
    firstSeenAt: "2026-09-13T00:00:00.000Z",
    observations,
  });

  const dnssecWrites = () =>
    snapshotsMock.updateSnapshot.mock.calls.filter(([, params]) => "dnssec" in params);

  const run = async () => {
    const { detectChangesWorkflow } = await import("./workflow");
    return detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });
  };

  describe("rollout: snapshots that predate DNSSEC tracking", () => {
    it.each(["secure", "insecure", "bogus"] as const)(
      "adopts a %s baseline silently instead of announcing a change",
      async (status) => {
        snapshotsMock.getSnapshot.mockResolvedValue(makeSnapshot({ dnssec: null }));
        dnssecResult(status);

        const result = await run();

        expect(result).toMatchObject({ skipped: false, dnssecChanges: false });
        expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status, pending: null } }]]);
        expect(notificationsMock.determineNotificationChannelsStep).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          "dnssecChanges",
        );
        expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
      },
    );

    it("does not store a baseline while DNSSEC is unobservable, and does not alert", async () => {
      snapshotsMock.getSnapshot.mockResolvedValue(makeSnapshot({ dnssec: null }));
      dnssecResult("indeterminate");

      const result = await run();

      expect(result).toMatchObject({ dnssecChanges: false });
      expect(dnssecWrites()).toEqual([]);
      expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
    });
  });

  it("skips the branch when DNSSEC is indeterminate, so a resolver hiccup can't look like it was disabled", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "secure", pending: null } }),
    );
    dnssecResult("indeterminate");

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: false });
    expect(dnssecWrites()).toEqual([]);
    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
  });

  it("writes nothing when the state matches the baseline", async () => {
    dnssecResult("insecure");

    await run();

    expect(dnssecWrites()).toEqual([]);
    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
  });

  it("holds a first sighting as pending without notifying", async () => {
    dnssecResult("secure");

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: false });
    expect(dnssecWrites()).toEqual([
      [
        "td-1",
        {
          dnssec: {
            status: "insecure",
            pending: expect.objectContaining({ key: "secure", observations: 1 }),
          },
        },
      ],
    ]);
    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
  });

  it("clears a stale pending observation when the state goes back to the baseline", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "insecure", pending: pending("secure") } }),
    );
    dnssecResult("insecure");

    await run();

    expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status: "insecure", pending: null } }]]);
    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
  });

  it("notifies on a confirmed change, then advances the baseline", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "insecure", pending: pending("secure") } }),
    );
    dnssecResult("secure");
    notificationsMock.sendDnssecChangeNotificationStep.mockResolvedValue(true);

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: true });
    expect(notificationsMock.determineNotificationChannelsStep).toHaveBeenCalledWith(
      "u1",
      "td-1",
      "dnssecChanges",
    );
    expect(notificationsMock.sendDnssecChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "DNSSEC enabled for example.com",
        emailSubject: "🔐 DNSSEC enabled for example.com",
        changes: { kind: "enabled", previousStatus: "insecure", newStatus: "secure" },
        idempotencyKey: "dnssec:td-1:insecure>secure",
      }),
      true,
      true,
    );
    expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status: "secure", pending: null } }]]);
  });

  it("alerts when validation breaks", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "secure", pending: pending("bogus") } }),
    );
    dnssecResult("bogus");
    notificationsMock.sendDnssecChangeNotificationStep.mockResolvedValue(true);

    await run();

    expect(notificationsMock.sendDnssecChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        emailSubject: "🚨 DNSSEC validation is failing for example.com",
        changes: { kind: "broken", previousStatus: "secure", newStatus: "bogus" },
        idempotencyKey: "dnssec:td-1:secure>bogus",
      }),
      true,
      true,
    );
  });

  it("alerts when DNSSEC is disabled", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "secure", pending: pending("insecure") } }),
    );
    dnssecResult("insecure");
    notificationsMock.sendDnssecChangeNotificationStep.mockResolvedValue(true);

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: true });
    expect(notificationsMock.sendDnssecChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "DNSSEC disabled for example.com",
        emailSubject: "⚠️ DNSSEC disabled for example.com",
        changes: { kind: "disabled", previousStatus: "secure", newStatus: "insecure" },
        idempotencyKey: "dnssec:td-1:secure>insecure",
      }),
      true,
      true,
    );
    expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status: "insecure", pending: null } }]]);
  });

  it.each([
    ["secure", "is passing again"],
    ["insecure", "no longer fails DNSSEC validation"],
  ] as const)("alerts when validation recovers to %s", async (newStatus, messageFragment) => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "bogus", pending: pending(newStatus) } }),
    );
    dnssecResult(newStatus);
    notificationsMock.sendDnssecChangeNotificationStep.mockResolvedValue(true);

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: true });
    expect(notificationsMock.sendDnssecChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        emailSubject: "✅ DNSSEC validation recovered for example.com",
        message: expect.stringContaining(messageFragment),
        changes: { kind: "recovered", previousStatus: "bogus", newStatus },
        idempotencyKey: `dnssec:td-1:bogus>${newStatus}`,
      }),
      true,
      true,
    );
    expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status: newStatus, pending: null } }]]);
  });

  it("restarts confirmation when the observed state differs from the pending one", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "insecure", pending: pending("secure") } }),
    );
    dnssecResult("bogus");

    await run();

    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
    expect(dnssecWrites()).toEqual([
      [
        "td-1",
        {
          dnssec: {
            status: "insecure",
            pending: expect.objectContaining({ key: "bogus", observations: 1 }),
          },
        },
      ],
    ]);
  });

  it("advances silently, without notifying, when both channels are off", async () => {
    notificationsMock.determineNotificationChannelsStep.mockResolvedValue({
      shouldSendEmail: false,
      shouldSendInApp: false,
    });
    dnssecResult("secure");

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: false });
    expect(notificationsMock.sendDnssecChangeNotificationStep).not.toHaveBeenCalled();
    expect(dnssecWrites()).toEqual([["td-1", { dnssec: { status: "secure", pending: null } }]]);
  });

  it("keeps the baseline and reuses the same idempotencyKey when delivery fails, so the retry re-sends", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ dnssec: { status: "insecure", pending: pending("secure") } }),
    );
    dnssecResult("secure");
    notificationsMock.sendDnssecChangeNotificationStep
      .mockRejectedValueOnce(new Error("insert failed"))
      .mockResolvedValueOnce(true);

    await expect(run()).rejects.toThrow("insert failed");
    expect(dnssecWrites()).toEqual([]);
    expect(monitorDedupMock.releaseMonitorLock).not.toHaveBeenCalled();

    const result = await run();

    expect(result).toMatchObject({ dnssecChanges: true });
    const keys = notificationsMock.sendDnssecChangeNotificationStep.mock.calls.map(
      ([params]) => params.idempotencyKey,
    );
    expect(keys).toEqual(["dnssec:td-1:insecure>secure", "dnssec:td-1:insecure>secure"]);
  });
});
