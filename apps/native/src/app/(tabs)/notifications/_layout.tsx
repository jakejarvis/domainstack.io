import { Stack } from "expo-router/stack";
import { useColorScheme } from "react-native";
import { useCSSVariable } from "uniwind";

export default function NotificationsLayout() {
  const canvas = useCSSVariable("--color-canvas") as string;
  const surface = useCSSVariable("--color-glass") as string;
  const text = useCSSVariable("--color-text-primary") as string;
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
