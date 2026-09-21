/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "@domainstack/logger";

// Hoist mocks for the dependencies the workflow's steps pull in via dynamic import.
const verifyDomainMock = vi.hoisted(() => ({
  verifyDomainOwnershipByMethod:
    vi.fn<typeof import("../steps/verification").verifyDomainOwnershipByMethod>(),
}));

const trackedDomainsMock = vi.hoisted(() => ({
  getTrackedDomainForReverification:
    vi.fn<
      typeof import("@domainstack/db/queries/tracked-domains").getTrackedDomainForReverification
    >(),
  markVerificationSuccessful:
    vi.fn<typeof import("@domainstack/db/queries/tracked-domains").markVerificationSuccessful>(),
  markVerificationFailing:
    vi.fn<typeof import("@domainstack/db/queries/tracked-domains").markVerificationFailing>(),
  revokeVerification:
    vi.fn<typeof import("@domainstack/db/queries/tracked-domains").revokeVerification>(),
}));

const notificationsQueryMock = vi.hoisted(() => ({
  hasRecentNotification:
    vi.fn<typeof import("@domainstack/db/queries/notifications").hasRecentNotification>(),
}));

const sharedNotificationsMock = vi.hoisted(() => ({
  sendNotification: vi.fn<typeof import("../steps/notifications").sendNotification>(),
}));

vi.mock("../steps/verification", () => verifyDomainMock);
vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("../steps/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/verification-failing", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));
vi.mock("@domainstack/email/templates/verification-revoked", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

const baseDomain = {
  id: "td-1",
  domainName: "example.com",
  userId: "u1",
  userName: "Alex Doe",
  userEmail: "a@example.com",
  verificationToken: "tok",
  verificationMethod: "dns_txt" as const,
  verificationStatus: "verified" as const,
  verificationFailedAt: null as Date | null,
};

describe("reverifyOwnershipWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T04:00:00Z"));

    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue(baseDomain as never);
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
    });
    sharedNotificationsMock.sendNotification.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recovery: marks success and sends no notification", async () => {
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: true,
      method: "dns_txt",
    } as never);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ verified: true, method: "dns_txt" });
    expect(trackedDomainsMock.markVerificationSuccessful).toHaveBeenCalledWith("td-1");
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("skips without touching grace-period state when the probe itself fails to complete", async () => {
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
      checkFailed: true,
    });

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "check_failed" });
    expect(trackedDomainsMock.markVerificationFailing).not.toHaveBeenCalled();
    expect(trackedDomainsMock.revokeVerification).not.toHaveBeenCalled();
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("logs the check_failed skip so a chronic probe failure isn't silently invisible", async () => {
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
      checkFailed: true,
    });
    vi.mocked(createLogger).mockClear();

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(createLogger).toHaveBeenCalledWith({ source: "workflows/reverify-ownership" });
    const loggerInstance = vi.mocked(createLogger).mock.results.at(-1)?.value;
    expect(loggerInstance?.warn).toHaveBeenCalledWith(
      { trackedDomainId: "td-1", domainName: "example.com", method: "dns_txt" },
      "reverification probe failed to complete; skipping this run",
    );
  });

  it("does not let a chronically failing probe freeze an already-running grace period forever", async () => {
    // A grace period is already in progress (a real failure was confirmed
    // earlier); this run's probe couldn't complete (checkFailed), but the
    // countdown must still progress instead of being skipped indefinitely.
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-10T04:00:00Z"), // 3 days before "now"
    } as never);
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
      checkFailed: true,
    });
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(true);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ verified: false, action: "in_grace_period" });
    expect(trackedDomainsMock.markVerificationFailing).not.toHaveBeenCalled();
  });

  it("skips a stale grace episode after another run records recovery", async () => {
    const failedAt = new Date("2026-09-05T04:00:00Z");
    trackedDomainsMock.getTrackedDomainForReverification
      .mockResolvedValueOnce({
        ...baseDomain,
        verificationStatus: "failing",
        verificationFailedAt: failedAt,
      } as never)
      .mockResolvedValueOnce(baseDomain as never);
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
      checkFailed: true,
    });

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "invalid_state" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    expect(trackedDomainsMock.revokeVerification).not.toHaveBeenCalled();
  });

  it("does not start grace when a failing row has no timestamp and the probe fails", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: null,
    } as never);
    verifyDomainMock.verifyDomainOwnershipByMethod.mockResolvedValue({
      verified: false,
      method: null,
      checkFailed: true,
    });

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "check_failed" });
    expect(trackedDomainsMock.markVerificationFailing).not.toHaveBeenCalled();
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("repairs a missing failure timestamp after a confirmed ownership failure", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: null,
    } as never);
    trackedDomainsMock.markVerificationFailing.mockResolvedValue({
      verificationFailedAt: new Date("2026-09-13T04:00:00Z"),
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(true);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(result).toEqual({ verified: false, action: "marked_failing" });
    expect(trackedDomainsMock.markVerificationFailing).toHaveBeenCalledWith(
      "td-1",
      "failing",
      null,
    );
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("skips when recovery wins between re-reading and marking the failure", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue(baseDomain as never);
    trackedDomainsMock.markVerificationFailing.mockResolvedValue(null);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(trackedDomainsMock.markVerificationFailing).toHaveBeenCalledWith(
      "td-1",
      "verified",
      null,
    );
    expect(result).toEqual({ skipped: true, reason: "invalid_state" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("first failure sends the warning", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "verified",
      verificationFailedAt: null,
    } as never);
    trackedDomainsMock.markVerificationFailing.mockResolvedValue({
      verificationFailedAt: new Date("2026-09-13T04:00:00Z"),
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(false);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(notificationsQueryMock.hasRecentNotification).toHaveBeenCalledWith(
      "td-1",
      "verification_failing",
      new Date("2026-09-13T03:00:00Z"),
    );
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: "verification_failing" }),
      true,
      true,
    );
    expect(result).toEqual({ verified: false, action: "marked_failing" });
  });

  it("regression: second episode within 30 days still sends", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "verified",
      verificationFailedAt: null,
    } as never);
    trackedDomainsMock.markVerificationFailing.mockResolvedValue({
      verificationFailedAt: new Date("2026-09-13T04:00:00Z"),
    } as never);

    // Behaves like the real query: an earlier verification_failing row sent
    // 10 days ago is only a duplicate if the window reaches that far back.
    notificationsQueryMock.hasRecentNotification.mockImplementation(async (_id, _type, since) => {
      const cutoff = since ?? new Date(Date.now() - 30 * 864e5);
      return new Date(Date.now() - 10 * 864e5) > cutoff;
    });

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("mid-grace: a lost warning is recovered", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-10T04:00:00Z"), // 3 days before now
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(false);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledTimes(1);
    const call = sharedNotificationsMock.sendNotification.mock.calls[0]?.[0] as {
      message: string;
    };
    expect(call.message).toContain("4 days");
    expect(trackedDomainsMock.markVerificationFailing).not.toHaveBeenCalled();
    expect(result).toEqual({ verified: false, action: "in_grace_period" });
  });

  it("mid-grace: already warned, no resend", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-10T04:00:00Z"),
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(true);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("revoke: sends the revoked email before revoking", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-05T04:00:00Z"), // 8 days before now
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(false);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: "verification_revoked" }),
      true,
      true,
    );
    expect(trackedDomainsMock.revokeVerification).toHaveBeenCalledWith("td-1");
    expect(sharedNotificationsMock.sendNotification.mock.invocationCallOrder[0]).toBeLessThan(
      trackedDomainsMock.revokeVerification.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ verified: false, action: "revoked" });
  });

  it("revoke: email failure prevents revocation", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-05T04:00:00Z"),
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(false);
    sharedNotificationsMock.sendNotification.mockRejectedValue(new Error("boom"));

    const { reverifyOwnershipWorkflow } = await import("./workflow");

    await expect(reverifyOwnershipWorkflow({ trackedDomainId: "td-1" })).rejects.toThrow("boom");
    expect(trackedDomainsMock.revokeVerification).not.toHaveBeenCalled();
  });

  it("revoke: retries revocation after an earlier sent email", async () => {
    trackedDomainsMock.getTrackedDomainForReverification.mockResolvedValue({
      ...baseDomain,
      verificationStatus: "failing",
      verificationFailedAt: new Date("2026-09-05T04:00:00Z"),
    } as never);
    notificationsQueryMock.hasRecentNotification.mockResolvedValue(true);

    const { reverifyOwnershipWorkflow } = await import("./workflow");
    const result = await reverifyOwnershipWorkflow({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    expect(trackedDomainsMock.revokeVerification).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ verified: false, action: "revoked" });
  });
});
