import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pushReceipts, userNotificationPreferences, userPushDevices, users } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import {
  getOrCreateUserNotificationPreferences,
  getPushDevicesForUser,
  insertPendingReceipts,
  markPushDeviceSendError,
  markPushDeviceSendSuccess,
  registerPushDevice,
  setPushDeviceEnabled,
  unregisterPushDevice,
  updateUserNotificationPreferences,
} from "./index";

const TEST_USER_ID = "push-test-user";
const TEST_USER_2_ID = "push-test-user-2";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

describe("push devices and notification preferences", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(pushReceipts);
    await testDb.delete(userPushDevices);
    await testDb.delete(userNotificationPreferences);
    await testDb.delete(users);
    await testDb.insert(users).values([
      {
        email: "push@example.com",
        id: TEST_USER_ID,
        name: "Push Tester",
      },
      {
        email: "push2@example.com",
        id: TEST_USER_2_ID,
        name: "Push Tester 2",
      },
    ]);
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("registers, updates, disables, and unregisters a push device", async () => {
    const first = await registerPushDevice({
      appVersion: "1.0.0",
      deviceName: "iPhone",
      expoPushToken: "ExponentPushToken[test]",
      platform: "ios",
      userId: TEST_USER_ID,
    });

    expect(first.enabled).toBe(true);
    expect(first.deviceName).toBe("iPhone");

    const updated = await registerPushDevice({
      appVersion: "1.0.1",
      deviceName: "Jake's iPhone",
      expoPushToken: "ExponentPushToken[test]",
      platform: "ios",
      userId: TEST_USER_ID,
    });

    expect(updated.id).toBe(first.id);
    expect(updated.deviceName).toBe("Jake's iPhone");

    const disabled = await setPushDeviceEnabled(TEST_USER_ID, "ExponentPushToken[test]", false);
    expect(disabled?.enabled).toBe(false);

    const devices = await getPushDevicesForUser(TEST_USER_ID);
    expect(devices).toHaveLength(1);

    expect(await unregisterPushDevice(TEST_USER_ID, "ExponentPushToken[test]")).toBe(true);
    expect(await unregisterPushDevice(TEST_USER_ID, "ExponentPushToken[test]")).toBe(false);
  });

  it("stores device model/type and preserves the created IP while refreshing the latest IP", async () => {
    const first = await registerPushDevice({
      deviceName: "Jake's iPhone",
      deviceModel: "iPhone 15 Pro",
      deviceType: "phone",
      manufacturer: "Apple",
      osName: "iOS",
      osVersion: "17.4.1",
      expoPushToken: "ExponentPushToken[ip]",
      platform: "ios",
      userId: TEST_USER_ID,
      ipAddress: "203.0.113.10",
    });

    expect(first.deviceModel).toBe("iPhone 15 Pro");
    expect(first.deviceType).toBe("phone");
    expect(first.manufacturer).toBe("Apple");
    expect(first.osName).toBe("iOS");
    expect(first.osVersion).toBe("17.4.1");
    expect(first.createdIp).toBe("203.0.113.10");
    expect(first.lastIp).toBe("203.0.113.10");

    const updated = await registerPushDevice({
      deviceName: "Jake's iPhone",
      deviceModel: "iPhone 15 Pro",
      deviceType: "phone",
      manufacturer: "Apple",
      osName: "iOS",
      osVersion: "18.0",
      expoPushToken: "ExponentPushToken[ip]",
      platform: "ios",
      userId: TEST_USER_ID,
      ipAddress: "198.51.100.42",
    });

    expect(updated.id).toBe(first.id);
    expect(updated.osVersion).toBe("18.0");
    expect(updated.createdIp).toBe("203.0.113.10");
    expect(updated.lastIp).toBe("198.51.100.42");

    await unregisterPushDevice(TEST_USER_ID, "ExponentPushToken[ip]");
  });

  it("reassigns a token when a different user registers it", async () => {
    const original = await registerPushDevice({
      deviceName: "Shared iPad",
      expoPushToken: "ExponentPushToken[shared]",
      platform: "ios",
      userId: TEST_USER_ID,
    });
    await insertPendingReceipts([
      {
        ticketId: "ticket-1",
        expoPushToken: "ExponentPushToken[shared]",
        userId: TEST_USER_ID,
      },
    ]);

    const reclaimed = await registerPushDevice({
      deviceName: "Shared iPad",
      expoPushToken: "ExponentPushToken[shared]",
      platform: "ios",
      userId: TEST_USER_2_ID,
    });

    expect(reclaimed.userId).toBe(TEST_USER_2_ID);
    expect(reclaimed.id).not.toBe(original.id);
    expect(await getPushDevicesForUser(TEST_USER_ID)).toHaveLength(0);
    expect(await getPushDevicesForUser(TEST_USER_2_ID)).toHaveLength(1);
    const remainingReceipts = await testDb.select().from(pushReceipts);
    expect(remainingReceipts).toHaveLength(0);
  });

  it("preserves explicit disabled state when a send succeeds", async () => {
    await registerPushDevice({
      expoPushToken: "ExponentPushToken[disabled]",
      platform: "ios",
      userId: TEST_USER_ID,
    });
    await setPushDeviceEnabled(TEST_USER_ID, "ExponentPushToken[disabled]", false);

    await markPushDeviceSendSuccess("ExponentPushToken[disabled]");

    const devices = await getPushDevicesForUser(TEST_USER_ID);
    expect(devices[0]?.enabled).toBe(false);
    expect(devices[0]?.lastSuccessAt).not.toBeNull();
  });

  it("deletes the device row on DeviceNotRegistered", async () => {
    await registerPushDevice({
      expoPushToken: "ExponentPushToken[dead]",
      platform: "ios",
      userId: TEST_USER_ID,
    });

    await markPushDeviceSendError("ExponentPushToken[dead]", "DeviceNotRegistered");

    const devices = await getPushDevicesForUser(TEST_USER_ID);
    expect(devices).toHaveLength(0);
  });

  it("records non-fatal send errors without disabling the device", async () => {
    await registerPushDevice({
      expoPushToken: "ExponentPushToken[network]",
      platform: "ios",
      userId: TEST_USER_ID,
    });

    await markPushDeviceSendError("ExponentPushToken[network]", "MessageRateExceeded");

    const devices = await getPushDevicesForUser(TEST_USER_ID);
    expect(devices[0]?.enabled).toBe(true);
    expect(devices[0]?.lastError).toBe("MessageRateExceeded");
  });

  it("includes push in default preferences and partial updates", async () => {
    const defaults = await getOrCreateUserNotificationPreferences(TEST_USER_ID);
    expect(defaults.domainExpiry).toEqual({ email: true, inApp: true, push: true });

    const updated = await updateUserNotificationPreferences(TEST_USER_ID, {
      domainExpiry: { email: true, inApp: false, push: false },
    });

    expect(updated.domainExpiry).toEqual({ email: true, inApp: false, push: false });
    expect(updated.certificateExpiry.push).toBe(true);
  });
});
