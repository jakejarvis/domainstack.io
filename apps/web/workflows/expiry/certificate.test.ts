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
  calculateDaysRemainingStep:
    vi.fn<typeof import("@/workflows/shared/notifications").calculateDaysRemainingStep>(),
  checkExpiryPreferencesStep:
    vi.fn<typeof import("@/workflows/shared/notifications").checkExpiryPreferencesStep>(),
  checkAlreadySentStep:
    vi.fn<typeof import("@/workflows/shared/notifications").checkAlreadySentStep>(),
  getThresholdNotificationType:
    vi.fn<typeof import("@/workflows/shared/notifications").getThresholdNotificationType>(),
  sendNotification: vi.fn<typeof import("@/workflows/shared/notifications").sendNotification>(),
}));

vi.mock("@domainstack/db/queries/certificates", () => certificatesQueryMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("@/workflows/shared/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/certificate-expiry", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

const baseCert = {
  trackedDomainId: "td-1",
  userId: "u1",
  domainId: "d-1",
  domainName: "example.com",
  muted: false,
  validTo: new Date("2026-09-27T00:00:00.000Z"),
  issuer: "Let's Encrypt",
  userEmail: "a@example.com",
  userName: "Alex Doe",
};

describe("checkCertificateExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(baseCert);
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(7);
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue("certificate_expiry_7d");
    sharedNotificationsMock.checkExpiryPreferencesStep.mockResolvedValue({
      shouldSendEmail: true,
      shouldSendInApp: true,
    });
    sharedNotificationsMock.checkAlreadySentStep.mockResolvedValue(false);
    sharedNotificationsMock.sendNotification.mockResolvedValue(true);
  });

  afterEach(() => {
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
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(60);
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

  it("already_expired: negative days remaining, no send", async () => {
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(-3);

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
      true,
      true,
    );
  });
});
