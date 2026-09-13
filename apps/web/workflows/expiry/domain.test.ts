/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mocks for the dependencies the branch's steps pull in via dynamic
// import, plus the shared notification step helpers it imports statically.
const trackedDomainsMock = vi.hoisted(() => ({
  getTrackedDomainForNotification:
    vi.fn<
      typeof import("@domainstack/db/queries/tracked-domains").getTrackedDomainForNotification
    >(),
}));

const notificationsQueryMock = vi.hoisted(() => ({
  clearDomainExpiryNotifications:
    vi.fn<typeof import("@domainstack/db/queries/notifications").clearDomainExpiryNotifications>(),
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

vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("@/workflows/shared/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/domain-expiry", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

const baseDomain = {
  id: "td-1",
  domainName: "example.com",
  userId: "u1",
  userName: "Alex Doe",
  userEmail: "a@example.com",
  muted: false,
  registrar: "Namecheap",
  expirationDate: "2026-10-20T00:00:00.000Z",
};

describe("checkDomainExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue(baseDomain as never);
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(7);
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue("domain_expiry_7d");
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

  it("not_found: missing tracked domain, no send", async () => {
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue(null);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("no_expiration_date: missing expiration, no send", async () => {
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
      ...baseDomain,
      expirationDate: null,
    } as never);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "no_expiration_date" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("invalid_expiration_date: unparseable expiration, no send", async () => {
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(Number.NaN);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "invalid_expiration_date" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("renewed: expiration beyond the max threshold clears notifications", async () => {
    sharedNotificationsMock.calculateDaysRemainingStep.mockResolvedValue(90);
    notificationsQueryMock.clearDomainExpiryNotifications.mockResolvedValue(3);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({
      skipped: true,
      reason: "renewed",
      renewed: true,
      clearedCount: 3,
    });
    expect(notificationsQueryMock.clearDomainExpiryNotifications).toHaveBeenCalledWith("td-1");
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("already_sent: due threshold already notified, no send", async () => {
    sharedNotificationsMock.checkAlreadySentStep.mockResolvedValue(true);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "already_sent" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("no_threshold_met: no notification type for the current days remaining", async () => {
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue(null);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "no_threshold_met" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("notifications_disabled: no channel enabled, no send", async () => {
    sharedNotificationsMock.checkExpiryPreferencesStep.mockResolvedValue({
      shouldSendEmail: false,
      shouldSendInApp: false,
    });

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "notifications_disabled" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("due threshold: sends with the domain email data and channel flags", async () => {
    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: false, sent: true });
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledTimes(1);
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        userEmail: "a@example.com",
        trackedDomainId: "td-1",
        domainName: "example.com",
        notificationType: "domain_expiry_7d",
        title: expect.stringContaining("example.com"),
        message: expect.stringContaining("Namecheap"),
      }),
      true,
      true,
    );
  });
});
