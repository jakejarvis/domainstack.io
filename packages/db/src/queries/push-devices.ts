import { and, eq, isNull } from "drizzle-orm";

import { db } from "../client";
import { pushReceipts, userPushDevices } from "../schema";

export type PushDevicePlatform = "ios" | "android";

export interface RegisterPushDeviceParams {
  userId: string;
  expoPushToken: string;
  platform: PushDevicePlatform;
  deviceName?: string | null;
  appVersion?: string | null;
}

export async function registerPushDevice(params: RegisterPushDeviceParams) {
  const now = new Date();
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: userPushDevices.id, userId: userPushDevices.userId })
      .from(userPushDevices)
      .where(eq(userPushDevices.expoPushToken, params.expoPushToken));

    // Expo tokens are tied to (device, install). If a different user previously
    // claimed this token, the device has changed hands — drop the stale row and
    // its pending receipts so notifications can't leak across accounts.
    if (existing && existing.userId !== params.userId) {
      await tx
        .delete(pushReceipts)
        .where(
          and(
            eq(pushReceipts.expoPushToken, params.expoPushToken),
            isNull(pushReceipts.processedAt),
          ),
        );
      await tx.delete(userPushDevices).where(eq(userPushDevices.id, existing.id));
    }

    const [device] = await tx
      .insert(userPushDevices)
      .values({
        userId: params.userId,
        expoPushToken: params.expoPushToken,
        platform: params.platform,
        deviceName: params.deviceName ?? null,
        appVersion: params.appVersion ?? null,
        enabled: true,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: userPushDevices.expoPushToken,
        set: {
          platform: params.platform,
          deviceName: params.deviceName ?? null,
          appVersion: params.appVersion ?? null,
          enabled: true,
          lastSeenAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return device;
  });
}

export async function getPushDevicesForUser(userId: string) {
  return await db.select().from(userPushDevices).where(eq(userPushDevices.userId, userId));
}

export async function getEnabledPushDevicesForUser(userId: string) {
  return await db
    .select()
    .from(userPushDevices)
    .where(and(eq(userPushDevices.userId, userId), eq(userPushDevices.enabled, true)));
}

export async function setPushDeviceEnabled(
  userId: string,
  expoPushToken: string,
  enabled: boolean,
) {
  const [device] = await db
    .update(userPushDevices)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(eq(userPushDevices.userId, userId), eq(userPushDevices.expoPushToken, expoPushToken)),
    )
    .returning();

  return device ?? null;
}

export async function unregisterPushDevice(userId: string, expoPushToken: string) {
  const deleted = await db
    .delete(userPushDevices)
    .where(
      and(eq(userPushDevices.userId, userId), eq(userPushDevices.expoPushToken, expoPushToken)),
    )
    .returning({ id: userPushDevices.id });

  return deleted.length > 0;
}

export async function markPushDeviceSendSuccess(expoPushToken: string) {
  // Preserve `enabled` state — a device the user explicitly disabled in settings
  // shouldn't flip back on after a successful send.
  await db
    .update(userPushDevices)
    .set({
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(userPushDevices.expoPushToken, expoPushToken));
}

export async function markPushDeviceSendError(expoPushToken: string, error: string) {
  // DeviceNotRegistered means the token is permanently dead per Expo's API.
  if (error === "DeviceNotRegistered") {
    await db.delete(userPushDevices).where(eq(userPushDevices.expoPushToken, expoPushToken));
    return;
  }

  await db
    .update(userPushDevices)
    .set({
      lastErrorAt: new Date(),
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(userPushDevices.expoPushToken, expoPushToken));
}
