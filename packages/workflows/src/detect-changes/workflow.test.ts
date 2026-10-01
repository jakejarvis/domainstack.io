/* @vitest-environment node */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANGE_CONFIRMATIONS } from "@domainstack/constants";
import type { DnsFetchData } from "@domainstack/core/dns/types";
import type { SnapshotForMonitoring } from "@domainstack/db/queries/snapshots";
import type {
  PendingChangeObservation,
  ProviderRef,
  RegistrationResponse,
  RegistrationSnapshotData,
} from "@domainstack/types";

import {
  confirmChange,
  providerObservationKey,
  registrationObservationKey,
  registrationSnapshotFrom,
} from "../lib/change-detection";

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
    vi.fn<typeof import("./notify").determineNotificationChannelsStep>(),
  resolveProviderNamesStep: vi.fn<typeof import("./notify").resolveProviderNamesStep>(),
  sendChangeNotificationStep: vi.fn<typeof import("./notify").sendChangeNotificationStep>(),
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
vi.mock("./notify", () => notificationsMock);
vi.mock("@domainstack/db/queries/snapshots", () => snapshotsMock);
vi.mock("../lib/monitor-lock", () => monitorDedupMock);

// Load the module (and its SDK / email / schema imports) under the hook
// timeout instead of inside the first test's budget.
beforeAll(async () => {
  await import("./workflow");
});

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

const NO_PROVIDER: ProviderRef = { id: null, name: null, domain: null };
const providerRef = (id: string | null): ProviderRef => ({ id, name: null, domain: null });

/**
 * A registered `RegistrationResponse`. By default `registrationSnapshotFrom` of
 * it equals `makeSnapshot().registration` (no registrar, nameservers, lock, or
 * statuses), i.e. the uninitialized baseline.
 */
function registered(overrides: Partial<RegistrationResponse> = {}): RegistrationResponse {
  return {
    domain: "example.com",
    tld: "com",
    isRegistered: true,
    status: "registered",
    source: "rdap",
    registrarProvider: NO_PROVIDER,
    nameservers: [],
    statuses: [],
    ...overrides,
  };
}

/** The registry reports the domain as gone. */
function unregistered(): RegistrationResponse {
  return registered({ isRegistered: false, status: "unregistered" });
}

/** The pending state one observation short of confirming `key`, built with the real helper. */
function pendingOneShort(key: string, firstSeenAt: string): PendingChangeObservation {
  let pending: PendingChangeObservation | null = null;
  for (let i = 0; i < CHANGE_CONFIRMATIONS - 1; i++) {
    const result = confirmChange(pending, key, new Date(firstSeenAt));
    if (result.confirmed) throw new Error("fixture reached confirmation too early");
    pending = result.pending;
  }
  if (!pending) throw new Error("CHANGE_CONFIRMATIONS must be at least 2 for this fixture");
  return pending;
}

function firstCallOrder(mock: { mock: { invocationCallOrder: number[] } }): number {
  const order = mock.mock.invocationCallOrder[0];
  if (order === undefined) throw new Error("mock was never called");
  return order;
}

async function runWorkflow() {
  const { detectChangesWorkflow } = await import("./workflow");
  return detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });
}

const BOTH_CHANNELS = { shouldSendEmail: true, shouldSendInApp: true };
const EPISODE = "2026-09-13T00:00:00.000Z";

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

  it("does not observe, write, or notify when there is no snapshot", async () => {
    // Eligibility (verified, not archived) is decided inside getSnapshot, which
    // is mocked here; the workflow only ever sees "snapshot or null".
    snapshotsMock.getSnapshot.mockResolvedValue(null);

    const { detectChangesWorkflow } = await import("./workflow");
    const result = await detectChangesWorkflow({
      trackedDomainId: "td-1",
      monitorLockOwnerToken: "tok",
    });

    expect(snapshotsMock.getSnapshot).toHaveBeenCalledWith("td-1");
    expect(result).toMatchObject({ skipped: true, reason: "snapshot_not_found" });
    expect(dnsMock.fetchDnsRecordsStep).not.toHaveBeenCalled();
    expect(snapshotsMock.updateSnapshot).not.toHaveBeenCalled();
    expect(notificationsMock.determineNotificationChannelsStep).not.toHaveBeenCalled();
    expect(notificationsMock.sendChangeNotificationStep).not.toHaveBeenCalled();
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

  it("fails fast with a FatalError and releases the lock when a snapshot write violates a constraint", async () => {
    const { FatalError } = await import("workflow");
    // A first registration observation against the uninitialized baseline
    // adopts the data with the first snapshot write.
    registrationMock.lookupWhoisStep.mockResolvedValue({
      success: true,
      data: { recordJson: "{}" },
    } as never);
    registrationMock.normalizeAndBuildResponseStep.mockResolvedValue({
      status: "registered",
      registrarProvider: { id: "reg-1", name: "Registrar" },
      nameservers: [],
      transferLock: null,
      statuses: [],
    } as never);
    registrationMock.persistRegistrationStep.mockResolvedValue(undefined);
    snapshotsMock.updateSnapshot.mockRejectedValue(
      new Error("duplicate key value violates unique constraint"),
    );

    const { detectChangesWorkflow } = await import("./workflow");
    const rejection = await detectChangesWorkflow({
      trackedDomainId: "td-1",
      monitorLockOwnerToken: "tok",
    }).catch((err: unknown) => err);

    expect(FatalError.is(rejection)).toBe(true);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith(
      "td-1",
      expect.objectContaining({ registration: expect.anything() }),
    );
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
    notificationsMock.sendChangeNotificationStep
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

    const expectedKey = `provider:td-1:${providerObservationKey({ dnsProviderId: "p-old", hostingProviderId: null, emailProviderId: null })}>${providerObservationKey({ dnsProviderId: "p-dns", hostingProviderId: null, emailProviderId: null })}@2026-09-13T00:00:00.000Z`;
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledTimes(2);
    for (const call of notificationsMock.sendChangeNotificationStep.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ idempotencyKey: expectedKey }));
    }
  });

  it("releases the monitor lock when a FatalError terminates the run, since nothing will retry it", async () => {
    const { FatalError } = await import("workflow");
    notificationsMock.sendChangeNotificationStep.mockRejectedValue(
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
    notificationsMock.sendChangeNotificationStep.mockResolvedValue(true);

    const { detectChangesWorkflow } = await import("./workflow");
    await detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });

    const expectedKey = `provider:td-1:${providerObservationKey({ dnsProviderId: "p-older", hostingProviderId: null, emailProviderId: null })}>${providerObservationKey({ dnsProviderId: "p-dns", hostingProviderId: null, emailProviderId: null })}@2026-09-13T00:00:00.000Z`;
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({ type: "provider_change", idempotencyKey: expectedKey }),
      { shouldSendEmail: true, shouldSendInApp: true },
    );
  });

  it("keys a later repeat of the same transition with a different idempotencyKey", async () => {
    const snapshotWithEpisode = (firstSeenAt: string) =>
      makeSnapshot({
        dnsProviderId: "p-old",
        providerPending: {
          key: providerObservationKey({
            dnsProviderId: "p-dns",
            hostingProviderId: null,
            emailProviderId: null,
          }),
          firstSeenAt,
          observations: CHANGE_CONFIRMATIONS - 1,
        },
      });
    notificationsMock.sendChangeNotificationStep.mockResolvedValue(true);

    const { detectChangesWorkflow } = await import("./workflow");

    snapshotsMock.getSnapshot.mockResolvedValue(snapshotWithEpisode("2026-09-13T00:00:00.000Z"));
    await detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });
    const firstKey = notificationsMock.sendChangeNotificationStep.mock.calls[0]?.[0].idempotencyKey;

    vi.clearAllMocks();
    notificationsMock.sendChangeNotificationStep.mockResolvedValue(true);
    snapshotsMock.getSnapshot.mockResolvedValue(snapshotWithEpisode("2026-09-14T00:00:00.000Z"));
    await detectChangesWorkflow({ trackedDomainId: "td-1", monitorLockOwnerToken: "tok" });
    const secondKey =
      notificationsMock.sendChangeNotificationStep.mock.calls[0]?.[0].idempotencyKey;

    expect(firstKey).toEqual(expect.any(String));
    expect(secondKey).toEqual(expect.any(String));
    expect(secondKey).not.toBe(firstKey);
  });
});

describe("registration change orchestration", () => {
  const storedRegistration = (
    overrides: Partial<RegistrationSnapshotData> = {},
  ): RegistrationSnapshotData => ({
    registrarProviderId: "p-old",
    nameservers: [],
    transferLock: null,
    statuses: [],
    ...overrides,
  });

  const observedRegistration = registered({ registrarProvider: providerRef("p-new") });
  const observedSnapshot = registrationSnapshotFrom(observedRegistration);
  const observedKey = registrationObservationKey(observedSnapshot);

  beforeEach(() => {
    registrationMock.lookupWhoisStep.mockResolvedValue({
      success: true,
      data: { recordJson: "{}" },
    });
    registrationMock.normalizeAndBuildResponseStep.mockResolvedValue(observedRegistration);
    registrationMock.persistRegistrationStep.mockResolvedValue(undefined);
    notificationsMock.sendChangeNotificationStep.mockResolvedValue(true);
  });

  it("holds the first sighting of a registrar change as pending without notifying", async () => {
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ registration: storedRegistration() }),
    );

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(false);
    expect(notificationsMock.sendChangeNotificationStep).not.toHaveBeenCalled();
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    // The previous registrar is kept; only `pending` records the observation.
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith("td-1", {
      registration: {
        ...storedRegistration(),
        pending: { key: observedKey, firstSeenAt: expect.any(String), observations: 1 },
      },
    });
  });

  it("notifies a confirmed registration change, then advances the snapshot", async () => {
    const stored = storedRegistration({ pending: pendingOneShort(observedKey, EPISODE) });
    snapshotsMock.getSnapshot.mockResolvedValue(makeSnapshot({ registration: stored }));

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(true);
    const expectedKey = `registration:td-1:${registrationObservationKey(stored)}>${observedKey}@${EPISODE}`;
    expect(expectedKey).toMatch(/^registration:td-1:.+>.+@.+$/);
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledTimes(1);
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "registration_change",
        idempotencyKey: expectedKey,
        changes: expect.objectContaining({
          registrarChanged: true,
          previousRegistrar: "p-old",
          newRegistrar: "p-new",
        }),
      }),
      BOTH_CHANNELS,
    );
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith("td-1", {
      registration: { ...observedSnapshot, pending: null },
    });
    // Advance only after the notification step has succeeded.
    expect(firstCallOrder(notificationsMock.sendChangeNotificationStep)).toBeLessThan(
      firstCallOrder(snapshotsMock.updateSnapshot),
    );
  });

  it("advances the snapshot immediately, without notifying, when no channel is enabled", async () => {
    notificationsMock.determineNotificationChannelsStep.mockResolvedValue({
      shouldSendEmail: false,
      shouldSendInApp: false,
    });
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ registration: storedRegistration() }),
    );

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(false);
    expect(notificationsMock.determineNotificationChannelsStep).toHaveBeenCalledWith(
      "u1",
      "td-1",
      "registrationChanges",
    );
    expect(notificationsMock.sendChangeNotificationStep).not.toHaveBeenCalled();
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith("td-1", {
      registration: { ...observedSnapshot, pending: null },
    });
  });

  it("adopts the first observation silently when the stored baseline is uninitialized", async () => {
    // makeSnapshot's default registration carries no data.
    registrationMock.normalizeAndBuildResponseStep.mockResolvedValue(
      registered({
        registrarProvider: providerRef("p-new"),
        nameservers: [{ host: "ns1.example.net" }],
        transferLock: true,
      }),
    );

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(false);
    expect(notificationsMock.determineNotificationChannelsStep).not.toHaveBeenCalled();
    expect(notificationsMock.sendChangeNotificationStep).not.toHaveBeenCalled();
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith("td-1", {
      registration: {
        registrarProviderId: "p-new",
        nameservers: [{ host: "ns1.example.net" }],
        transferLock: true,
        statuses: [],
        pending: null,
      },
    });
  });

  it("notifies a confirmed unregistered drop, keeps the previous registrar, and flags the snapshot", async () => {
    registrationMock.normalizeAndBuildResponseStep.mockResolvedValue(unregistered());
    const stored = storedRegistration({ pending: pendingOneShort("unregistered", EPISODE) });
    snapshotsMock.getSnapshot.mockResolvedValue(makeSnapshot({ registration: stored }));

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(true);
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledTimes(1);
    expect(notificationsMock.sendChangeNotificationStep).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "registration_change",
        idempotencyKey: `registration:td-1:${registrationObservationKey(stored)}>unregistered@${EPISODE}`,
        changes: expect.objectContaining({ unregistered: true, previousRegistrar: "p-old" }),
      }),
      BOTH_CHANNELS,
    );
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshotsMock.updateSnapshot).toHaveBeenCalledWith("td-1", {
      registration: { ...storedRegistration(), pending: null, unregistered: true },
    });
    expect(firstCallOrder(notificationsMock.sendChangeNotificationStep)).toBeLessThan(
      firstCallOrder(snapshotsMock.updateSnapshot),
    );
  });

  it("does nothing for an unregistered drop that was already flagged", async () => {
    registrationMock.normalizeAndBuildResponseStep.mockResolvedValue(unregistered());
    snapshotsMock.getSnapshot.mockResolvedValue(
      makeSnapshot({ registration: storedRegistration({ unregistered: true }) }),
    );

    const result = await runWorkflow();

    expect(result.registrationChanges).toBe(false);
    expect(notificationsMock.determineNotificationChannelsStep).not.toHaveBeenCalled();
    expect(notificationsMock.sendChangeNotificationStep).not.toHaveBeenCalled();
    expect(snapshotsMock.updateSnapshot).not.toHaveBeenCalled();
  });
});
