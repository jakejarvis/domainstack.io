import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android 8+ requires every notification to belong to a channel; without an
// explicit one the OS surfaces our pushes under a generic "Miscellaneous"
// label in the system settings.
async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Domain alerts",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      enableVibrate: true,
    });
  } catch {
    // Best-effort: a missing channel only downgrades to default importance.
  }
}

// Warm up the channel at import time, but registration also awaits it so the
// channel is guaranteed to exist before the first token is requested.
void ensureAndroidChannelAsync();

type DeviceInfo = {
  deviceName: string | null;
  deviceModel: string | null;
  deviceType: string | null;
  manufacturer: string | null;
  osName: string | null;
  osVersion: string | null;
};

export type PushRegistrationResult =
  | ({ status: "granted"; expoPushToken: string } & DeviceInfo)
  | ({ status: "denied" | "undetermined"; expoPushToken: null } & DeviceInfo);

export function getPushPlatform(): "ios" | "android" {
  return Platform.OS === "android" ? "android" : "ios";
}

function getDeviceTypeLabel(): string | null {
  switch (Device.deviceType) {
    case Device.DeviceType.PHONE:
      return "phone";
    case Device.DeviceType.TABLET:
      return "tablet";
    case Device.DeviceType.DESKTOP:
      return "desktop";
    case Device.DeviceType.TV:
      return "tv";
    default:
      return null;
  }
}

export async function requestExpoPushToken(): Promise<PushRegistrationResult> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  const deviceInfo: DeviceInfo = {
    deviceName: Device.deviceName ?? Device.modelName ?? null,
    deviceModel: Device.modelName ?? null,
    deviceType: getDeviceTypeLabel(),
    manufacturer: Device.manufacturer ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
  };
  if (finalStatus !== "granted") {
    return { status: finalStatus, expoPushToken: null, ...deviceInfo };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("Expo project ID is required before push tokens can be registered.");
  }

  // Guarantee the Android channel exists before the first token is issued.
  await ensureAndroidChannelAsync();

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: "granted", expoPushToken: token.data, ...deviceInfo };
}
