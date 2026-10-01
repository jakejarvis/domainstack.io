/* @vitest-environment node */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "@domainstack/core/lib/fetch-errors";

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

const expiryNotifyMock = vi.hoisted(() => ({
  checkExpiryPreferencesStep: vi.fn<typeof import("./notify").checkExpiryPreferencesStep>(),
  checkAlreadySentStep: vi.fn<typeof import("./notify").checkAlreadySentStep>(),
}));

const sharedNotificationsMock = vi.hoisted(() => ({
  sendNotification: vi.fn<typeof import("../steps/notifications").sendNotification>(),
}));

const lookupMock = vi.hoisted(() => ({
  fetchSection: vi.fn<typeof import("@domainstack/core/lookup").fetchSection>(),
}));

vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);
vi.mock("@domainstack/core/lookup", () => lookupMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("./notify", () => expiryNotifyMock);
vi.mock("../steps/notifications", () => sharedNotificationsMock);
vi.mock("@domainstack/email/templates/domain-expiry", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

// Load the module (and its SDK / email / schema imports) under the hook
// timeout instead of inside the first test's budget.
beforeAll(async () => {
  await import("./domain");
});

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
  // Cache window is open (expires 12h from NOW), so no refresh is needed.
  registrationFetchedAt: new Date(NOW.getTime() - 12 * 3_600_000),
  registrationExpiresAt: new Date(NOW.getTime() + 12 * 3_600_000),
};

// Cache window elapsed an hour ago: the expiry check must refresh first.
const staleWindow = {
  registrationFetchedAt: new Date(NOW.getTime() - 25 * 3_600_000),
  registrationExpiresAt: new Date(NOW.getTime() - 3_600_000),
};

describe("checkDomainExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue(baseDomain as never);
    expiryNotifyMock.checkExpiryPreferencesStep.mockResolvedValue({
      shouldSendEmail: true,
      shouldSendInApp: true,
    });
    expiryNotifyMock.checkAlreadySentStep.mockResolvedValue(false);
    sharedNotificationsMock.sendNotification.mockResolvedValue(true);
    lookupMock.fetchSection.mockResolvedValue({ success: true, data: {} } as never);
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

  it("not_found: an archived or unverified tracked domain is filtered by the loader, nothing is sent", async () => {
    // getTrackedDomainForNotification returns null unless verified and not archived.
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue(null);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(trackedDomainsMock.getTrackedDomainForNotification).toHaveBeenCalledWith("td-1");
    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(expiryNotifyMock.checkExpiryPreferencesStep).not.toHaveBeenCalled();
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
    expiryNotifyMock.checkAlreadySentStep.mockResolvedValue(true);

    const { checkDomainExpiry } = await import("./domain");
    const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "already_sent" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("notifications_disabled: no channel enabled, no send", async () => {
    expiryNotifyMock.checkExpiryPreferencesStep.mockResolvedValue({
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

  it("title wording: 0 days reads 'within 24 hours', 1 day reads 'in 1 day'", async () => {
    const { checkDomainExpiry } = await import("./domain");
    const titleFor = async (days: number) => {
      trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
        ...baseDomain,
        expirationDate: inDays(days).toISOString(),
      } as never);
      await checkDomainExpiry({ trackedDomainId: "td-1" });
      return sharedNotificationsMock.sendNotification.mock.calls.at(-1)?.[0].title;
    };

    expect(await titleFor(0)).toBe("example.com expires within 24 hours");
    expect(await titleFor(1)).toBe("example.com expires in 1 day");
    expect(await titleFor(5)).toBe("example.com expires in 5 days");
  });

  it("dedupe key: identical for the same expiration and threshold, different after a renewal", async () => {
    const { checkDomainExpiry } = await import("./domain");
    const keyOfLastSend = () => {
      const call = sharedNotificationsMock.sendNotification.mock.calls.at(-1);
      return call?.[0].dedupeKey;
    };

    await checkDomainExpiry({ trackedDomainId: "td-1" });
    const first = keyOfLastSend();
    await checkDomainExpiry({ trackedDomainId: "td-1" });
    expect(keyOfLastSend()).toBe(first);
    expect(first).toBe(`domain-expiry:td-1:${baseDomain.expirationDate}:domain_expiry_7d`);

    // Renewed by a day but still inside the same threshold window.
    trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
      ...baseDomain,
      expirationDate: inDays(6).toISOString(),
    } as never);
    await checkDomainExpiry({ trackedDomainId: "td-1" });
    expect(keyOfLastSend()).toBeTypeOf("string");
    expect(keyOfLastSend()).not.toBe(first);
  });

  describe("freshness", () => {
    it("fresh metadata: does not refresh and evaluates the loaded row", async () => {
      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: false, sent: true });
      expect(lookupMock.fetchSection).not.toHaveBeenCalled();
      expect(trackedDomainsMock.getTrackedDomainForNotification).toHaveBeenCalledTimes(1);
    });

    it("stale metadata + successful refresh: refreshes once, reloads, and uses the new date", async () => {
      trackedDomainsMock.getTrackedDomainForNotification
        .mockResolvedValueOnce({
          ...baseDomain,
          ...staleWindow,
          expirationDate: inDays(7).toISOString(),
        } as never)
        .mockResolvedValueOnce({
          ...baseDomain,
          expirationDate: inDays(6).toISOString(),
        } as never);

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: false, sent: true });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(lookupMock.fetchSection).toHaveBeenCalledWith("registration", "example.com");
      expect(trackedDomainsMock.getTrackedDomainForNotification).toHaveBeenCalledTimes(2);
      expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupeKey: `domain-expiry:td-1:${inDays(6).toISOString()}:domain_expiry_7d`,
          message: expect.stringContaining("example.com"),
        }),
        { shouldSendEmail: true, shouldSendInApp: true },
      );
    });

    it("stale old threshold that was renewed by the refresh: clears old notifications and does not send", async () => {
      trackedDomainsMock.getTrackedDomainForNotification
        .mockResolvedValueOnce({ ...baseDomain, ...staleWindow } as never)
        .mockResolvedValueOnce({
          ...baseDomain,
          expirationDate: inDays(365).toISOString(),
        } as never);
      notificationsQueryMock.clearDomainExpiryNotifications.mockResolvedValue(2);

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({
        skipped: true,
        reason: "renewed",
        renewed: true,
        clearedCount: 2,
      });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(notificationsQueryMock.clearDomainExpiryNotifications).toHaveBeenCalledWith("td-1");
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + typed failure: data_unavailable, no already-sent check, no send", async () => {
      trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
        ...baseDomain,
        ...staleWindow,
      } as never);
      lookupMock.fetchSection.mockResolvedValue({
        success: false,
        error: "whois_unavailable",
      } as never);

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(trackedDomainsMock.getTrackedDomainForNotification).toHaveBeenCalledTimes(1);
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + RemoteDataUnavailableError: data_unavailable, no already-sent check, no send", async () => {
      trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
        ...baseDomain,
        ...staleWindow,
      } as never);
      lookupMock.fetchSection.mockRejectedValue(new RemoteDataUnavailableError("WHOIS timed out"));

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + unexpected refresh error: propagates so the step retries", async () => {
      trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
        ...baseDomain,
        ...staleWindow,
      } as never);
      lookupMock.fetchSection.mockRejectedValue(new Error("boom"));

      const { checkDomainExpiry } = await import("./domain");

      await expect(checkDomainExpiry({ trackedDomainId: "td-1" })).rejects.toThrow("boom");
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale before refresh but archived or unverified on reload: not_found, no send", async () => {
      trackedDomainsMock.getTrackedDomainForNotification
        .mockResolvedValueOnce({ ...baseDomain, ...staleWindow } as never)
        .mockResolvedValueOnce(null);

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "not_found" });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(expiryNotifyMock.checkExpiryPreferencesStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("still stale after a successful refresh: data_unavailable, no send", async () => {
      trackedDomainsMock.getTrackedDomainForNotification.mockResolvedValue({
        ...baseDomain,
        ...staleWindow,
      } as never);

      const { checkDomainExpiry } = await import("./domain");
      const result = await checkDomainExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });
  });
});
