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

if (Platform.OS === "android") {
  // Android 8+ requires every notification to belong to a channel; without an
  // explicit one the OS surfaces our pushes under a generic "Miscellaneous"
  // label in the system settings.
  void Notifications.setNotificationChannelAsync("default", {
    name: "Domain alerts",
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    enableVibrate: true,
  });
}

export type PushRegistrationResult =
  | { status: "granted"; expoPushToken: string; deviceName: string | null }
  | { status: "denied" | "undetermined"; expoPushToken: null; deviceName: string | null };

export function getPushPlatform(): "ios" | "android" {
  return Platform.OS === "android" ? "android" : "ios";
}

export async function requestExpoPushToken(): Promise<PushRegistrationResult> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  const deviceName = Device.deviceName ?? Device.modelName ?? null;
  if (finalStatus !== "granted") {
    return { status: finalStatus, expoPushToken: null, deviceName };
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("Expo project ID is required before push tokens can be registered.");
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: "granted", expoPushToken: token.data, deviceName };
}
