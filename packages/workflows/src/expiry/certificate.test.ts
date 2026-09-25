/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks for the dependencies the branch's steps pull in via dynamic
// import, plus the shared notification step helpers it imports statically.
const certificatesQueryMock = vi.hoisted(() => ({
  getEarliestCertificate:
    vi.fn<typeof import("@domainstack/db/queries/certificates").getEarliestCertificate>(),
}));

const notificationsQueryMock = vi.hoisted(() => ({
  clearCertificateExpiryNotifications:
    vi.fn<
      typeof import("@domainstack/db/queries/notifications").clearCertificateExpiryNotifications
    >(),
}));

const sharedNotificationsMock = vi.hoisted(() => ({
  checkExpiryPreferencesStep:
    vi.fn<typeof import("../steps/notifications").checkExpiryPreferencesStep>(),
  checkAlreadySentStep: vi.fn<typeof import("../steps/notifications").checkAlreadySentStep>(),
  getThresholdNotificationType:
    vi.fn<typeof import("../steps/notifications").getThresholdNotificationType>(),
  sendNotification: vi.fn<typeof import("../steps/notifications").sendNotification>(),
}));

vi.mock("@domainstack/db/queries/certificates", () => certificatesQueryMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("../steps/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/certificate-expiry", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

// Days remaining is computed in the workflow body from `Date`, so pin the clock
// and express dates relative to it. The extra hour keeps `Math.floor` on N.
const NOW = new Date("2026-09-20T12:00:00.000Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000 + 3_600_000);

const baseCert = {
  trackedDomainId: "td-1",
  userId: "u1",
  domainId: "d-1",
  domainName: "example.com",
  muted: false,
  validTo: inDays(7),
  issuer: "Let's Encrypt",
  userEmail: "a@example.com",
  userName: "Alex Doe",
};

describe("checkCertificateExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(baseCert);
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue("certificate_expiry_7d");
    sharedNotificationsMock.checkExpiryPreferencesStep.mockResolvedValue({
      shouldSendEmail: true,
      shouldSendInApp: true,
    });
    sharedNotificationsMock.checkAlreadySentStep.mockResolvedValue(false);
    sharedNotificationsMock.sendNotification.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("not_found: no leaf certificate, no send", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(null);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("renewed: certificate beyond the max threshold clears notifications", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validTo: inDays(60),
    });
    notificationsQueryMock.clearCertificateExpiryNotifications.mockResolvedValue(2);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({
      skipped: true,
      reason: "renewed",
      renewed: true,
      clearedCount: 2,
    });
    expect(notificationsQueryMock.clearCertificateExpiryNotifications).toHaveBeenCalledWith("td-1");
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("already_sent: due threshold already notified, no send", async () => {
    sharedNotificationsMock.checkAlreadySentStep.mockResolvedValue(true);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "already_sent" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("no_threshold_met: no notification type for the current days remaining", async () => {
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue(null);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "no_threshold_met" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("invalid_expiration_date: unparseable valid-to date, no send", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validTo: new Date(Number.NaN),
    });

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "invalid_expiration_date" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("already_expired: negative days remaining, no send", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validTo: inDays(-3),
    });

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "already_expired" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("due threshold: sends with the issuer, valid-to date, and channel flags", async () => {
    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: false, sent: true });
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        userEmail: "a@example.com",
        trackedDomainId: "td-1",
        domainName: "example.com",
        notificationType: "certificate_expiry_7d",
        title: expect.stringContaining("example.com"),
        message: expect.stringContaining("Let's Encrypt"),
      }),
      { shouldSendEmail: true, shouldSendInApp: true },
    );
  });
});
