import { beforeEach, describe, expect, it, vi } from "vitest";
/* @vitest-environment node */

// Hoist mocks for the dependencies sendNotification pulls in via dynamic import.
const sendEmailMock = vi.hoisted(() => ({
  sendEmail: vi.fn<typeof import("./email").sendEmail>(),
}));
const notificationsMock = vi.hoisted(() => ({
  createNotification:
    vi.fn<typeof import("@domainstack/db/queries/notifications").createNotification>(),
  updateNotificationResendId:
    vi.fn<typeof import("@domainstack/db/queries/notifications").updateNotificationResendId>(),
}));
const trackedDomainsMock = vi.hoisted(() => ({
  isTrackedDomainNotificationEligible:
    vi.fn<
      typeof import("@domainstack/db/queries/tracked-domains").isTrackedDomainNotificationEligible
    >(),
}));

vi.mock("./email", () => sendEmailMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsMock);
vi.mock("@domainstack/db/queries/tracked-domains", () => trackedDomainsMock);

describe("sendNotification with a dedupeKey", () => {
  const options = {
    userId: "user-1",
    userEmail: "user@example.com",
    trackedDomainId: "tracked-1",
    domainName: "example.com",
    notificationType: "domain_expiry_7d" as const,
    title: "example.com expires in 7 days",
    message: "Your domain example.com will expire soon.",
    emailSubject: "example.com expires in 7 days",
    emailComponent: {} as React.ReactElement,
    dedupeKey: "domain-expiry:tracked-1:2026-10-05T00:00:00.000Z:domain_expiry_7d",
  };
  const channels = { shouldSendEmail: true, shouldSendInApp: true };

  beforeEach(() => {
    vi.clearAllMocks();
    notificationsMock.updateNotificationResendId.mockResolvedValue(true);
    trackedDomainsMock.isTrackedDomainNotificationEligible.mockResolvedValue(true);
    sendEmailMock.sendEmail.mockResolvedValue({ emailId: "em_1" });
  });

  it("uses the dedupe key as the email idempotency key and passes it to createNotification", async () => {
    notificationsMock.createNotification.mockResolvedValue({
      notification: { id: "n_1" },
      created: true,
    } as never);

    const { sendNotification } = await import("./notifications");
    const result = await sendNotification(options, channels);

    expect(result).toBe(true);
    expect(sendEmailMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: options.dedupeKey }),
    );
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: options.dedupeKey }),
    );
    expect(notificationsMock.updateNotificationResendId).toHaveBeenCalledWith("n_1", "em_1");
  });

  it("prefers an explicit idempotencyKey over the dedupe key for the email", async () => {
    notificationsMock.createNotification.mockResolvedValue({
      notification: { id: "n_1" },
      created: true,
    } as never);

    const { sendNotification } = await import("./notifications");
    await sendNotification({ ...options, idempotencyKey: "explicit-key" }, channels);

    expect(sendEmailMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "explicit-key" }),
    );
  });

  it("returns false and leaves the winner's row alone when the insert race is lost", async () => {
    notificationsMock.createNotification.mockResolvedValue({
      notification: { id: "n_winner" },
      created: false,
    } as never);

    const { sendNotification } = await import("./notifications");
    const result = await sendNotification(options, channels);

    expect(result).toBe(false);
    expect(notificationsMock.updateNotificationResendId).not.toHaveBeenCalled();
  });
});
