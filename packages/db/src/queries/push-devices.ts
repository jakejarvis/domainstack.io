import { and, eq } from "drizzle-orm";

import { db } from "../client";
import { userPushDevices } from "../schema";

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
  const [device] = await db
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
        userId: params.userId,
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
  await db
    .update(userPushDevices)
    .set({
      enabled: true,
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(userPushDevices.expoPushToken, expoPushToken));
}

export async function markPushDeviceSendError(expoPushToken: string, error: string) {
  const updates = {
    lastErrorAt: new Date(),
    lastError: error,
    updatedAt: new Date(),
    ...(error === "DeviceNotRegistered" ? { enabled: false } : {}),
  };

  await db
    .update(userPushDevices)
    .set(updates)
    .where(eq(userPushDevices.expoPushToken, expoPushToken));
}
