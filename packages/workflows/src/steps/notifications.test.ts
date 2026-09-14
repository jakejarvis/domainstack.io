import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
/* @vitest-environment node */
import { FatalError, RetryableError } from "workflow";

import type { ProviderChangeWithNames } from "@domainstack/types";

// Hoist mocks for the dependencies sendNotificationInternal pulls in via dynamic import.
const sendEmailMock = vi.hoisted(() => ({
  getEmailBaseUrl: vi
    .fn<typeof import("./email").getEmailBaseUrl>()
    .mockReturnValue("https://test.domainstack.io"),
  sendEmail: vi.fn<typeof import("./email").sendEmail>(),
}));
const notificationsMock = vi.hoisted(() => ({
  createNotification:
    vi.fn<typeof import("@domainstack/db/queries/notifications").createNotification>(),
  updateNotificationResendId:
    vi.fn<typeof import("@domainstack/db/queries/notifications").updateNotificationResendId>(),
}));

vi.mock("./email", () => sendEmailMock);
vi.mock("@domainstack/db/queries/notifications", () => notificationsMock);
// A truthy stand-in: sendNotificationInternal gates the email path on
// `emailComponent` being present, so a real `null` render would (incorrectly)
// look identical to "no template" and skip the send entirely.
vi.mock("@domainstack/email/templates/provider-change", () => ({
  default: vi.fn<() => React.ReactElement>().mockReturnValue({} as React.ReactElement),
}));

const baseParams = {
  userId: "user-1",
  userEmail: "user@example.com",
  trackedDomainId: "tracked-1",
  domainName: "example.com",
  userName: "Alex",
  title: "Provider change detected",
  message: "Your DNS provider changed.",
  emailSubject: "Provider change for example.com",
  changes: {} as ProviderChangeWithNames,
  idempotencyKey: 'provider:tracked-1:["a",null,null]>["b",null,null]',
};

describe("sendProviderChangeNotificationStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationsMock.createNotification.mockResolvedValue({ id: "n_1" } as never);
    notificationsMock.updateNotificationResendId.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends email and in-app, then records the notification with both channels", async () => {
    sendEmailMock.sendEmail.mockResolvedValue({ emailId: "em_1" });

    const { sendProviderChangeNotificationStep } = await import("./notifications");
    const result = await sendProviderChangeNotificationStep(baseParams, true, true);

    expect(result).toBe(true);
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["email", "in-app"] }),
    );
    expect(notificationsMock.updateNotificationResendId).toHaveBeenCalledWith("n_1", "em_1");
  });

  it("degrades to in-app only when the email fails permanently", async () => {
    sendEmailMock.sendEmail.mockRejectedValue(new FatalError("validation_error"));

    const { sendProviderChangeNotificationStep } = await import("./notifications");
    const result = await sendProviderChangeNotificationStep(baseParams, true, true);

    expect(result).toBe(true);
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["in-app"] }),
    );
    expect(notificationsMock.updateNotificationResendId).not.toHaveBeenCalled();
  });

  it("resolves false and skips the notification record when email fails permanently with in-app off", async () => {
    sendEmailMock.sendEmail.mockRejectedValue(new FatalError("validation_error"));

    const { sendProviderChangeNotificationStep } = await import("./notifications");
    const result = await sendProviderChangeNotificationStep(baseParams, true, false);

    expect(result).toBe(false);
    expect(notificationsMock.createNotification).not.toHaveBeenCalled();
  });

  it("rejects and does not record when the email fails transiently", async () => {
    sendEmailMock.sendEmail.mockRejectedValue(new RetryableError("rate_limit_exceeded"));

    const { sendProviderChangeNotificationStep } = await import("./notifications");

    await expect(sendProviderChangeNotificationStep(baseParams, true, true)).rejects.toThrow(
      "rate_limit_exceeded",
    );
    expect(notificationsMock.createNotification).not.toHaveBeenCalled();
  });

  it("resolves false and never calls sendEmail when both channels are off", async () => {
    const { sendProviderChangeNotificationStep } = await import("./notifications");
    const result = await sendProviderChangeNotificationStep(baseParams, false, false);

    expect(result).toBe(false);
    expect(sendEmailMock.getEmailBaseUrl).not.toHaveBeenCalled();
    expect(sendEmailMock.sendEmail).not.toHaveBeenCalled();
  });

  it("records an in-app-only notification without rendering email content", async () => {
    const { sendProviderChangeNotificationStep } = await import("./notifications");
    const result = await sendProviderChangeNotificationStep(baseParams, false, true);

    expect(result).toBe(true);
    expect(sendEmailMock.getEmailBaseUrl).not.toHaveBeenCalled();
    expect(sendEmailMock.sendEmail).not.toHaveBeenCalled();
    expect(notificationsMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ["in-app"] }),
    );
  });

  it("rejects with a plain error (not FatalError) when createNotification fails", async () => {
    sendEmailMock.sendEmail.mockResolvedValue({ emailId: "em_1" });
    notificationsMock.createNotification.mockRejectedValue(new Error("connection terminated"));

    const { sendProviderChangeNotificationStep } = await import("./notifications");

    const rejection = await sendProviderChangeNotificationStep(baseParams, true, true).catch(
      (err) => err,
    );
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe("connection terminated");
    expect(FatalError.is(rejection)).toBe(false);
    expect(notificationsMock.updateNotificationResendId).not.toHaveBeenCalled();
  });

  it("forwards the idempotency key to sendEmail", async () => {
    sendEmailMock.sendEmail.mockResolvedValue({ emailId: "em_1" });

    const { sendProviderChangeNotificationStep } = await import("./notifications");
    await sendProviderChangeNotificationStep(baseParams, true, true);

    expect(sendEmailMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: baseParams.idempotencyKey }),
    );
  });
});
