import { Stack } from "expo-router/stack";
import { useColorScheme } from "react-native";

import { useCSSVariable } from "@/tw";

export default function NotificationsLayout() {
  const canvas = useCSSVariable("--color-canvas");
  const surface = useCSSVariable("--color-glass");
  const text = useCSSVariable("--color-text-primary");
  const isDark = useColorScheme() === "dark";

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: canvas },
        headerBlurEffect: isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: surface },
        headerTintColor: text,
      }}
    >
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: "Notifications" }} />
    </Stack>
  );
}
