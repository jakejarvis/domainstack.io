import { Stack } from "expo-router/stack";
import { useColorScheme } from "react-native";
import { useCSSVariable } from "uniwind";

export default function SearchLayout() {
  const canvas = useCSSVariable("--color-background") as string;
  const surface = useCSSVariable("--color-glass") as string;
  const text = useCSSVariable("--color-foreground") as string;
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
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: "Search" }} />
    </Stack>
  );
}
