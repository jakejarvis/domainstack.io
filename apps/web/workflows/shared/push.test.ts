import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

import {
  buildExpoPushMessages,
  buildPushData,
  sendPushForNotificationStep,
  uniquePushDevices,
} from "./push";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";

const mockQueries = {
  getEnabledPushDevicesForUser:
    vi.fn<(userId: string) => Promise<Array<{ expoPushToken: string }>>>(),
  getDispatchedTokensForNotification: vi.fn<(id: string) => Promise<Set<string>>>(),
  getUnreadCount: vi.fn<(userId: string) => Promise<number>>(),
  insertPendingReceipts: vi.fn<(rows: unknown[]) => Promise<void>>(),
  insertDispatchedMarkers: vi.fn<(rows: unknown[]) => Promise<void>>(),
  markPushDeviceSendSuccess: vi.fn<(token: string) => Promise<void>>(),
  markPushDeviceSendError: vi.fn<(token: string, error: string) => Promise<void>>(),
};

vi.mock("@domainstack/db/queries", () => mockQueries);

describe("push notification fanout", () => {
  it("routes domain notifications to the name-keyed native deep link", () => {
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
      url: "domainstack://domains/example.com",
    });
  });

  it("falls back to the notifications deep link when the domain name is missing", () => {
    expect(
      buildPushData({
        domainName: null,
        notificationId: "notification-1",
        trackedDomainId: "tracked-1",
      }).url,
    ).toBe("domainstack://notifications");
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
      { message: "Body", notificationId: "notification-1", title: "Title" },
      devices,
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.data.url).toBe("domainstack://notifications");
  });
});

describe("sendPushForNotificationStep", () => {
  beforeEach(() => {
    for (const fn of Object.values(mockQueries)) fn.mockReset();
    mockQueries.getDispatchedTokensForNotification.mockResolvedValue(new Set());
    mockQueries.getUnreadCount.mockResolvedValue(0);
    mockQueries.insertPendingReceipts.mockResolvedValue(undefined);
    mockQueries.insertDispatchedMarkers.mockResolvedValue(undefined);
    mockQueries.markPushDeviceSendSuccess.mockResolvedValue(undefined);
    mockQueries.markPushDeviceSendError.mockResolvedValue(undefined);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  const baseInput = {
    userId: "user-1",
    notificationId: "notif-1",
    title: "Title",
    message: "Body",
    trackedDomainId: "tracked-1",
    domainName: "example.com",
  };

  it("throws (for durable retry) on a 2xx response carrying top-level errors", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
    ]);
    server.use(
      http.post(EXPO_SEND_URL, () =>
        HttpResponse.json({ errors: [{ code: "TOO_MANY_REQUESTS", message: "slow down" }] }),
      ),
    );

    await expect(sendPushForNotificationStep(baseInput)).rejects.toThrow(/errors/i);
    expect(mockQueries.markPushDeviceSendSuccess).not.toHaveBeenCalled();
    expect(mockQueries.insertPendingReceipts).not.toHaveBeenCalled();
  });

  it("throws on a 429 so the step retries", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
    ]);
    server.use(http.post(EXPO_SEND_URL, () => new HttpResponse(null, { status: 429 })));

    await expect(sendPushForNotificationStep(baseInput)).rejects.toThrow(/429/);
    expect(mockQueries.markPushDeviceSendSuccess).not.toHaveBeenCalled();
  });

  it("sets the iOS badge to the user's unread count", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
    ]);
    mockQueries.getUnreadCount.mockResolvedValue(7);
    let sentBadge: unknown;
    server.use(
      http.post(EXPO_SEND_URL, async ({ request }) => {
        const body = (await request.json()) as Array<{ badge?: number }>;
        sentBadge = body[0]?.badge;
        return HttpResponse.json({ data: body.map((_, i) => ({ status: "ok", id: `r-${i}` })) });
      }),
    );

    await sendPushForNotificationStep(baseInput);

    expect(sentBadge).toBe(7);
  });

  it("chunks >100 devices into separate Expo requests", async () => {
    const devices = Array.from({ length: 150 }, (_, i) => ({
      expoPushToken: `ExponentPushToken[${i}]`,
    }));
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue(devices);

    const chunkSizes: number[] = [];
    server.use(
      http.post(EXPO_SEND_URL, async ({ request }) => {
        const body = (await request.json()) as unknown[];
        chunkSizes.push(body.length);
        return HttpResponse.json({
          data: body.map((_, i) => ({ status: "ok", id: `r-${chunkSizes.length}-${i}` })),
        });
      }),
    );

    await sendPushForNotificationStep(baseInput);

    expect(chunkSizes).toEqual([100, 50]);
    expect(mockQueries.markPushDeviceSendSuccess).toHaveBeenCalledTimes(150);
    expect(mockQueries.insertPendingReceipts).toHaveBeenCalledTimes(2);
  });

  it("records a missing ticket as a device error without a receipt or false success", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
      { expoPushToken: "ExponentPushToken[b]" },
    ]);
    server.use(
      http.post(EXPO_SEND_URL, () =>
        // Only one ticket for two devices.
        HttpResponse.json({ data: [{ status: "ok", id: "receipt-a" }] }),
      ),
    );

    await sendPushForNotificationStep(baseInput);

    expect(mockQueries.markPushDeviceSendSuccess).toHaveBeenCalledExactlyOnceWith(
      "ExponentPushToken[a]",
    );
    expect(mockQueries.markPushDeviceSendError).toHaveBeenCalledExactlyOnceWith(
      "ExponentPushToken[b]",
      "NoTicketReturned",
    );
    expect(mockQueries.insertPendingReceipts).toHaveBeenCalledWith([
      expect.objectContaining({ ticketId: "receipt-a", expoPushToken: "ExponentPushToken[a]" }),
    ]);
  });

  it("records a dispatch marker for a status-ok ticket without an id", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
    ]);
    server.use(
      // Status-ok but no ticket id (rare from Expo).
      http.post(EXPO_SEND_URL, () => HttpResponse.json({ data: [{ status: "ok" }] })),
    );

    await sendPushForNotificationStep(baseInput);

    expect(mockQueries.markPushDeviceSendSuccess).toHaveBeenCalledExactlyOnceWith(
      "ExponentPushToken[a]",
    );
    expect(mockQueries.insertPendingReceipts).not.toHaveBeenCalled();
    expect(mockQueries.insertDispatchedMarkers).toHaveBeenCalledWith([
      expect.objectContaining({
        ticketId: "noid:notif-1:ExponentPushToken[a]",
        expoPushToken: "ExponentPushToken[a]",
        notificationId: "notif-1",
      }),
    ]);
  });

  it("skips devices already dispatched for this notification (idempotent retry)", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
      { expoPushToken: "ExponentPushToken[b]" },
    ]);
    mockQueries.getDispatchedTokensForNotification.mockResolvedValue(
      new Set(["ExponentPushToken[a]"]),
    );

    let sentTokens: string[] = [];
    server.use(
      http.post(EXPO_SEND_URL, async ({ request }) => {
        const body = (await request.json()) as Array<{ to: string }>;
        sentTokens = body.map((m) => m.to);
        return HttpResponse.json({ data: body.map((_, i) => ({ status: "ok", id: `r-${i}` })) });
      }),
    );

    await sendPushForNotificationStep(baseInput);

    expect(sentTokens).toEqual(["ExponentPushToken[b]"]);
    expect(mockQueries.markPushDeviceSendSuccess).toHaveBeenCalledExactlyOnceWith(
      "ExponentPushToken[b]",
    );
  });

  it("deletes the device when Expo reports DeviceNotRegistered in a ticket", async () => {
    mockQueries.getEnabledPushDevicesForUser.mockResolvedValue([
      { expoPushToken: "ExponentPushToken[a]" },
    ]);
    server.use(
      http.post(EXPO_SEND_URL, () =>
        HttpResponse.json({
          data: [{ status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }],
        }),
      ),
    );

    await sendPushForNotificationStep(baseInput);

    expect(mockQueries.markPushDeviceSendError).toHaveBeenCalledExactlyOnceWith(
      "ExponentPushToken[a]",
      "DeviceNotRegistered",
    );
    expect(mockQueries.markPushDeviceSendSuccess).not.toHaveBeenCalled();
  });
});
