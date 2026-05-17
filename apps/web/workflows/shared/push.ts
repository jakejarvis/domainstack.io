import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "push-notifications" });

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
// Expo rejects a /push/send POST with more than 100 messages
// (PUSH_TOO_MANY_NOTIFICATIONS); fan out in chunks.
const EXPO_PUSH_CHUNK_SIZE = 100;

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, string | null>;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushSendResponse = {
  data?: ExpoPushTicket[];
  errors?: { code: string; message: string }[];
};

type PushDeviceForDelivery = {
  expoPushToken: string;
};

export function buildPushData(input: {
  notificationId: string;
  trackedDomainId?: string | null;
  domainName?: string | null;
}) {
  // The native tap router (`routeFromNotificationData`) keys the domain route
  // by domain *name*, not the tracked-domain UUID — keep `url` consistent so
  // it stays a valid deep link if expo-router URL handling is ever enabled.
  if (input.trackedDomainId) {
    return {
      notificationId: input.notificationId,
      trackedDomainId: input.trackedDomainId,
      domainName: input.domainName ?? null,
      url: input.domainName
        ? `domainstack://domains/${input.domainName}`
        : "domainstack://notifications",
    };
  }

  return {
    notificationId: input.notificationId,
    trackedDomainId: null,
    domainName: input.domainName ?? null,
    url: "domainstack://notifications",
  };
}

export function uniquePushDevices<T extends PushDeviceForDelivery>(devices: T[]): T[] {
  const seen = new Set<string>();
  return devices.filter((device) => {
    if (seen.has(device.expoPushToken)) return false;
    seen.add(device.expoPushToken);
    return true;
  });
}

export function buildExpoPushMessages(
  input: {
    notificationId: string;
    title: string;
    message: string;
    trackedDomainId?: string | null;
    domainName?: string | null;
  },
  devices: PushDeviceForDelivery[],
): ExpoPushMessage[] {
  return uniquePushDevices(devices).map((device) => ({
    to: device.expoPushToken,
    title: input.title,
    body: input.message,
    sound: "default",
    data: buildPushData(input),
  }));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Durable workflow step that fans a notification out to the user's enabled
 * push devices via Expo.
 *
 * Idempotent by `notificationId`: devices that already have a receipt row for
 * this notification are skipped, so a durable retry never double-pushes.
 * Transient Expo failures (429/5xx, request-level `errors`) throw so the step
 * retries; a 2xx response with a missing per-device ticket is recorded as a
 * device error (never a false success) and retried on the next notification. A
 * status-ok ticket without an id still records a dispatch marker, so it too is
 * idempotent across durable retries.
 */
export async function sendPushForNotificationStep(input: {
  userId: string;
  notificationId: string;
  title: string;
  message: string;
  trackedDomainId?: string | null;
  domainName?: string | null;
}): Promise<void> {
  "use step";

  const {
    getDispatchedTokensForNotification,
    getEnabledPushDevicesForUser,
    insertDispatchedMarkers,
    insertPendingReceipts,
    markPushDeviceSendError,
    markPushDeviceSendSuccess,
  } = await import("@domainstack/db/queries");

  const devices = await getEnabledPushDevicesForUser(input.userId);
  if (devices.length === 0) return;

  let deliveryDevices = uniquePushDevices(devices);

  // Idempotency guard: skip any device already dispatched for this
  // notification (set on a prior, partially-completed run of this step).
  const alreadyDispatched = await getDispatchedTokensForNotification(input.notificationId);
  if (alreadyDispatched.size > 0) {
    deliveryDevices = deliveryDevices.filter(
      (device) => !alreadyDispatched.has(device.expoPushToken),
    );
  }
  if (deliveryDevices.length === 0) return;

  const messages = buildExpoPushMessages(input, deliveryDevices);
  const deviceChunks = chunk(deliveryDevices, EXPO_PUSH_CHUNK_SIZE);
  const messageChunks = chunk(messages, EXPO_PUSH_CHUNK_SIZE);

  for (let c = 0; c < messageChunks.length; c++) {
    const chunkDevices = deviceChunks[c];
    const chunkMessages = messageChunks[c];

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(chunkMessages),
    });

    if (!response.ok) {
      // 429 / 5xx are transient — throw so the durable step retries. The
      // idempotency guard prevents double-pushing already-delivered devices.
      if (response.status === 429 || response.status >= 500) {
        logger.error(
          { status: response.status, retryAfter: response.headers.get("retry-after") },
          "expo push service request failed (retryable)",
        );
        throw new Error(`Expo push send failed with status ${response.status}`);
      }
      // Other 4xx are not retryable — log and skip this chunk.
      logger.error({ status: response.status }, "expo push service request failed");
      continue;
    }

    const payload = (await response.json().catch(() => null)) as ExpoPushSendResponse | null;

    if (payload?.errors && payload.errors.length > 0) {
      // Request-level failure (rate limit, too many notifications, malformed):
      // no per-message tickets. Throw so the step retries durably rather than
      // silently recording a delivery that never happened.
      const codes = payload.errors.map((error) => error.code).join(", ");
      logger.error({ codes, userId: input.userId }, "expo push send returned request errors");
      throw new Error(`Expo push send returned errors: ${codes}`);
    }

    const tickets = payload?.data ?? [];
    const pendingReceipts: Array<{
      ticketId: string;
      expoPushToken: string;
      userId: string;
      notificationId: string | null;
    }> = [];
    // Status-ok tickets that lacked an id (rare): no receipt to poll, but we
    // still record a marker so a durable retry doesn't re-push the device.
    const dispatchedMarkers: typeof pendingReceipts = [];

    await Promise.all(
      chunkDevices.map(async (device, index) => {
        const ticket = tickets[index];

        if (!ticket) {
          // 2xx response but no ticket for this device — not a success. No
          // receipt is written, so the device is retried on the next send.
          await markPushDeviceSendError(device.expoPushToken, "NoTicketReturned");
          logger.warn({ userId: input.userId }, "expo push ticket missing for device");
          return;
        }

        if (ticket.status === "ok") {
          await markPushDeviceSendSuccess(device.expoPushToken);
          if (ticket.id) {
            pendingReceipts.push({
              ticketId: ticket.id,
              expoPushToken: device.expoPushToken,
              userId: input.userId,
              notificationId: input.notificationId,
            });
          } else {
            // Deterministic synthetic id so a retry collides on the unique
            // constraint instead of inserting a duplicate marker.
            dispatchedMarkers.push({
              ticketId: `noid:${input.notificationId}:${device.expoPushToken}`,
              expoPushToken: device.expoPushToken,
              userId: input.userId,
              notificationId: input.notificationId,
            });
          }
          return;
        }

        const error = ticket.details?.error ?? ticket.message ?? "Unknown push error";
        await markPushDeviceSendError(device.expoPushToken, error);
        logger.warn({ error, userId: input.userId }, "expo push ticket failed");
      }),
    );

    // Persist this chunk's receipts before attempting the next chunk so a
    // later-chunk throw can't lose the idempotency record for delivered ones.
    if (pendingReceipts.length > 0) {
      await insertPendingReceipts(pendingReceipts);
    }
    if (dispatchedMarkers.length > 0) {
      await insertDispatchedMarkers(dispatchedMarkers);
    }
  }
}
