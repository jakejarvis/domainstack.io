import { Stack } from "expo-router/stack";
import { useColorScheme } from "react-native";

import { useCSSVariable } from "@/tw";

export default function DomainsLayout() {
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
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: "Portfolio" }} />
      <Stack.Screen name="add" options={{ presentation: "modal", title: "Add Domain" }} />
      <Stack.Screen name="archived" options={{ title: "Archived" }} />
      <Stack.Screen name="[domain]" options={{ title: "Domain" }} />
    </Stack>
  );
}
