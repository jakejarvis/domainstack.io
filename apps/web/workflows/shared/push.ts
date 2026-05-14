import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "push-notifications" });

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

type PushDeviceForDelivery = {
  expoPushToken: string;
};

export function buildPushData(input: {
  notificationId: string;
  trackedDomainId?: string | null;
  domainName?: string | null;
}) {
  if (input.trackedDomainId) {
    return {
      notificationId: input.notificationId,
      trackedDomainId: input.trackedDomainId,
      domainName: input.domainName ?? null,
      url: `domainstack://domains/${input.trackedDomainId}`,
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
    getEnabledPushDevicesForUser,
    insertPendingReceipts,
    markPushDeviceSendError,
    markPushDeviceSendSuccess,
  } = await import("@domainstack/db/queries");

  const devices = await getEnabledPushDevicesForUser(input.userId);
  if (devices.length === 0) return;

  const deliveryDevices = uniquePushDevices(devices);
  const messages = buildExpoPushMessages(input, deliveryDevices);

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "expo push service request failed");
    return;
  }

  const payload = (await response.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
  const tickets = payload?.data ?? [];
  const pendingReceipts: Array<{
    ticketId: string;
    expoPushToken: string;
    userId: string;
    notificationId: string | null;
  }> = [];

  await Promise.all(
    deliveryDevices.map(async (device, index) => {
      const ticket = tickets[index];
      if (!ticket || ticket.status === "ok") {
        await markPushDeviceSendSuccess(device.expoPushToken);
        if (ticket?.id) {
          pendingReceipts.push({
            ticketId: ticket.id,
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

  if (pendingReceipts.length > 0) {
    await insertPendingReceipts(pendingReceipts);
  }
}
