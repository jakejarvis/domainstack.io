import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { userNotificationPreferences, userPushDevices, users } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import {
  getOrCreateUserNotificationPreferences,
  getPushDevicesForUser,
  markPushDeviceSendError,
  registerPushDevice,
  setPushDeviceEnabled,
  unregisterPushDevice,
  updateUserNotificationPreferences,
} from "./index";

const TEST_USER_ID = "push-test-user";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

describe("push devices and notification preferences", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(userPushDevices);
    await testDb.delete(userNotificationPreferences);
    await testDb.delete(users);
    await testDb.insert(users).values({
      email: "push@example.com",
      id: TEST_USER_ID,
      name: "Push Tester",
    });
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

    await markPushDeviceSendError("ExponentPushToken[test]", "DeviceNotRegistered");
    const afterError = await getPushDevicesForUser(TEST_USER_ID);
    expect(afterError[0]?.enabled).toBe(false);
    expect(afterError[0]?.lastError).toBe("DeviceNotRegistered");

    expect(await unregisterPushDevice(TEST_USER_ID, "ExponentPushToken[test]")).toBe(true);
    expect(await unregisterPushDevice(TEST_USER_ID, "ExponentPushToken[test]")).toBe(false);
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
