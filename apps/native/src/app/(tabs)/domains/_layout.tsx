import { Stack } from "expo-router";

export default function DomainsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#08110e" },
        headerBlurEffect: "systemChromeMaterialDark",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "rgba(8, 17, 14, 0.78)" },
        headerTintColor: "#f6faf7",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ title: "Add Domain" }} />
      <Stack.Screen name="[id]" options={{ title: "Domain" }} />
    </Stack>
  );
}
