import { describe, expect, it } from "vitest";

import { buildExpoPushMessages, buildPushData, uniquePushDevices } from "./push";

describe("push notification fanout", () => {
  it("routes domain notifications to native domain detail", () => {
    expect(
      buildPushData({
        domainName: "example.com",
        notificationId: "notification-1",
        trackedDomainId: "tracked-1",
      }),
    ).toEqual({
      domainName: "example.com",
      notificationId: "notification-1",
      trackedDomainId: "tracked-1",
      url: "domainstack://domains/tracked-1",
    });
  });

  it("deduplicates devices by Expo push token before fanout", () => {
    const devices = uniquePushDevices([
      { expoPushToken: "ExponentPushToken[a]" },
      { expoPushToken: "ExponentPushToken[a]" },
      { expoPushToken: "ExponentPushToken[b]" },
    ]);

    expect(devices.map((device) => device.expoPushToken)).toEqual([
      "ExponentPushToken[a]",
      "ExponentPushToken[b]",
    ]);

    const messages = buildExpoPushMessages(
      {
        message: "Body",
        notificationId: "notification-1",
        title: "Title",
      },
      devices,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.data.url).toBe("domainstack://notifications");
  });
});
