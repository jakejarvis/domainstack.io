import { describe, expect, it } from "vitest";

import { resolveNotificationChannels } from "./notifications";

describe("resolveNotificationChannels", () => {
  it("returns all disabled channels for muted domains", () => {
    expect(
      resolveNotificationChannels(true, {
        email: true,
        inApp: true,
        push: true,
      }),
    ).toEqual({
      shouldSendEmail: false,
      shouldSendInApp: false,
      shouldSendPush: false,
    });
  });

  it("maps in-app, email, and push preferences independently", () => {
    expect(
      resolveNotificationChannels(false, {
        email: false,
        inApp: true,
        push: false,
      }),
    ).toEqual({
      shouldSendEmail: false,
      shouldSendInApp: true,
      shouldSendPush: false,
    });
  });
});
