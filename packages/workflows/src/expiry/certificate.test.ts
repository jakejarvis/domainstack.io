/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteDataUnavailableError } from "@domainstack/core/lib/fetch-errors";

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

vi.mock("@domainstack/db/queries/certificates", () => certificatesQueryMock);
vi.mock("@domainstack/core/lookup", () => lookupMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsQueryMock);
vi.mock("./notify", () => expiryNotifyMock);
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
  // 90-day-style certificate: validTo - validFrom is 90 days.
  validFrom: inDays(-83),
  validTo: inDays(7),
  issuer: "Let's Encrypt",
  // Check window is open (expires 12h from NOW), so no refresh is needed.
  checkFetchedAt: new Date(NOW.getTime() - 12 * 3_600_000),
  checkExpiresAt: new Date(NOW.getTime() + 12 * 3_600_000),
  userEmail: "a@example.com",
  userName: "Alex Doe",
};

// Check window elapsed an hour ago: the expiry check must refresh first.
const staleWindow = {
  checkFetchedAt: new Date(NOW.getTime() - 25 * 3_600_000),
  checkExpiresAt: new Date(NOW.getTime() - 3_600_000),
};

describe("checkCertificateExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(baseCert);
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

  it("not_found: no leaf certificate, no send", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(null);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("not_found: an archived or unverified tracked domain is filtered by the loader, nothing is sent", async () => {
    // getEarliestCertificate returns null unless the tracked domain is verified and not archived.
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(null);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(certificatesQueryMock.getEarliestCertificate).toHaveBeenCalledWith("td-1");
    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(expiryNotifyMock.checkExpiryPreferencesStep).not.toHaveBeenCalled();
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
    expiryNotifyMock.checkAlreadySentStep.mockResolvedValue(true);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "already_sent" });
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

  // A ~6.7-day certificate (Let's Encrypt short-lived profile), built with
  // explicit dates so the day count is exact.
  const shortLived = (daysLeft: number) => {
    const validTo = new Date(NOW.getTime() + daysLeft * 86_400_000);
    return { ...baseCert, validFrom: new Date(validTo.getTime() - 6.7 * 86_400_000), validTo };
  };

  it("short-lived certificate with days left: treated as renewed, clears old notifications", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(shortLived(5.5));
    notificationsQueryMock.clearCertificateExpiryNotifications.mockResolvedValue(1);

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "renewed", renewed: true, clearedCount: 1 });
    expect(notificationsQueryMock.clearCertificateExpiryNotifications).toHaveBeenCalledWith("td-1");
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("short-lived certificate under 24 h left: renewal is overdue, sends", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue(shortLived(0.5));

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: false, sent: true });
    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "certificate_expiry_1d",
        title: "SSL certificate for example.com expires within 24 hours",
      }),
      { shouldSendEmail: true, shouldSendInApp: true },
    );
  });

  it("short_lived: a 2-day certificate never alerts", async () => {
    const validTo = new Date(NOW.getTime() + 1.5 * 86_400_000);
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validFrom: new Date(validTo.getTime() - 2 * 86_400_000),
      validTo,
    });

    const { checkCertificateExpiry } = await import("./certificate");
    const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(result).toEqual({ skipped: true, reason: "short_lived" });
    expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
  });

  it("title wording: 1 day left reads 'in 1 day', never 'tomorrow'", async () => {
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validTo: inDays(1),
    });

    const { checkCertificateExpiry } = await import("./certificate");
    await checkCertificateExpiry({ trackedDomainId: "td-1" });

    expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "SSL certificate for example.com expires in 1 day" }),
      expect.anything(),
    );
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

  it("dedupe key: identical for the same certificate and threshold, different after a renewal or reissue", async () => {
    const { checkCertificateExpiry } = await import("./certificate");
    const keyOfLastSend = () => {
      const call = sharedNotificationsMock.sendNotification.mock.calls.at(-1);
      return call?.[0].dedupeKey;
    };

    await checkCertificateExpiry({ trackedDomainId: "td-1" });
    const first = keyOfLastSend();
    await checkCertificateExpiry({ trackedDomainId: "td-1" });
    expect(keyOfLastSend()).toBe(first);
    expect(first).toMatch(
      new RegExp(
        `^certificate-expiry:td-1:${baseCert.validTo.toISOString()}:[0-9a-f]{16}:certificate_expiry_7d$`,
      ),
    );

    // Renewed by a day but still inside the same threshold window.
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      validTo: inDays(6),
    });
    await checkCertificateExpiry({ trackedDomainId: "td-1" });
    const renewed = keyOfLastSend();
    expect(renewed).not.toBe(first);

    // Same expiry from a different issuer is a different certificate.
    certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
      ...baseCert,
      issuer: "Google Trust Services",
    });
    await checkCertificateExpiry({ trackedDomainId: "td-1" });
    expect(keyOfLastSend()).not.toBe(first);
  });

  describe("freshness", () => {
    it("fresh metadata: does not refresh and evaluates the loaded row", async () => {
      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: false, sent: true });
      expect(lookupMock.fetchSection).not.toHaveBeenCalled();
      expect(certificatesQueryMock.getEarliestCertificate).toHaveBeenCalledTimes(1);
    });

    it("stale metadata + successful refresh: refreshes once, reloads, and uses the new certificate", async () => {
      certificatesQueryMock.getEarliestCertificate
        .mockResolvedValueOnce({ ...baseCert, ...staleWindow })
        .mockResolvedValueOnce({ ...baseCert, validTo: inDays(6) });

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: false, sent: true });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(lookupMock.fetchSection).toHaveBeenCalledWith("certificates", "example.com");
      expect(certificatesQueryMock.getEarliestCertificate).toHaveBeenCalledTimes(2);
      expect(sharedNotificationsMock.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupeKey: expect.stringContaining(`:${inDays(6).toISOString()}:`),
          notificationType: "certificate_expiry_7d",
        }),
        { shouldSendEmail: true, shouldSendInApp: true },
      );
    });

    it("missing certificate check row (null freshness): treated as stale and refreshed", async () => {
      certificatesQueryMock.getEarliestCertificate
        .mockResolvedValueOnce({ ...baseCert, checkFetchedAt: null, checkExpiresAt: null })
        .mockResolvedValueOnce(baseCert);

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: false, sent: true });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(certificatesQueryMock.getEarliestCertificate).toHaveBeenCalledTimes(2);
    });

    it("stale old threshold that was renewed by the refresh: clears old notifications and does not send", async () => {
      certificatesQueryMock.getEarliestCertificate
        .mockResolvedValueOnce({ ...baseCert, ...staleWindow })
        .mockResolvedValueOnce({ ...baseCert, validTo: inDays(85) });
      notificationsQueryMock.clearCertificateExpiryNotifications.mockResolvedValue(2);

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({
        skipped: true,
        reason: "renewed",
        renewed: true,
        clearedCount: 2,
      });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(notificationsQueryMock.clearCertificateExpiryNotifications).toHaveBeenCalledWith(
        "td-1",
      );
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + typed failure: data_unavailable, no already-sent check, no send", async () => {
      certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
        ...baseCert,
        ...staleWindow,
      });
      lookupMock.fetchSection.mockResolvedValue({
        success: false,
        error: "dns_error",
      } as never);

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(certificatesQueryMock.getEarliestCertificate).toHaveBeenCalledTimes(1);
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + RemoteDataUnavailableError: data_unavailable, no already-sent check, no send", async () => {
      certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
        ...baseCert,
        ...staleWindow,
      });
      lookupMock.fetchSection.mockRejectedValue(new RemoteDataUnavailableError("host unreachable"));

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(expiryNotifyMock.checkAlreadySentStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale metadata + unexpected refresh error: propagates so the step retries", async () => {
      certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
        ...baseCert,
        ...staleWindow,
      });
      lookupMock.fetchSection.mockRejectedValue(new Error("boom"));

      const { checkCertificateExpiry } = await import("./certificate");

      await expect(checkCertificateExpiry({ trackedDomainId: "td-1" })).rejects.toThrow("boom");
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("stale before refresh but archived or unverified on reload: not_found, no send", async () => {
      certificatesQueryMock.getEarliestCertificate
        .mockResolvedValueOnce({ ...baseCert, ...staleWindow })
        .mockResolvedValueOnce(null);

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "not_found" });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(expiryNotifyMock.checkExpiryPreferencesStep).not.toHaveBeenCalled();
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });

    it("still stale after a successful refresh: data_unavailable, no send", async () => {
      certificatesQueryMock.getEarliestCertificate.mockResolvedValue({
        ...baseCert,
        ...staleWindow,
      });

      const { checkCertificateExpiry } = await import("./certificate");
      const result = await checkCertificateExpiry({ trackedDomainId: "td-1" });

      expect(result).toEqual({ skipped: true, reason: "data_unavailable" });
      expect(lookupMock.fetchSection).toHaveBeenCalledTimes(1);
      expect(sharedNotificationsMock.sendNotification).not.toHaveBeenCalled();
    });
  });
});
