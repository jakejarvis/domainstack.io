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
  checkExpiryPreferencesStep:
    vi.fn<typeof import("../steps/notifications").checkExpiryPreferencesStep>(),
  checkAlreadySentStep: vi.fn<typeof import("../steps/notifications").checkAlreadySentStep>(),
  getThresholdNotificationType:
    vi.fn<typeof import("../steps/notifications").getThresholdNotificationType>(),
  sendNotification: vi.fn<typeof import("../steps/notifications").sendNotification>(),
}));

vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("../steps/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/domain-expiry", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

// Days remaining is computed in the workflow body from `Date`, so pin the clock
// and express dates relative to it. The extra hour keeps `Math.floor` on N.
const NOW = new Date("2026-09-20T12:00:00.000Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000 + 3_600_000);

const baseDomain = {
  id: "td-1",
  domainName: "example.com",
  userId: "u1",
  userName: "Alex Doe",
  userEmail: "a@example.com",
  muted: false,
  registrar: "Namecheap",
  expirationDate: inDays(7).toISOString(),
};

describe("checkDomainExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue(baseDomain as never);
    sharedNotificationsMock.getThresholdNotificationType.mockReturnValue("domain_expiry_7d");
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
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
      ...baseDomain,
      expirationDate: "not-a-date",
    } as never);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "invalid_expiration_date" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("renewed: expiration beyond the max threshold clears notifications", async () => {
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
      ...baseDomain,
      expirationDate: inDays(90).toISOString(),
    } as never);
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
      { shouldSendEmail: true, shouldSendInApp: true },
    );
  });
});
