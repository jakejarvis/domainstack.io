import { Stack } from "expo-router/stack";

import { useStackScreenOptions } from "@/lib/screen-options";

export default function DomainsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: "Portfolio" }} />
      <Stack.Screen name="add" options={{ presentation: "modal", title: "Add domain" }} />
      <Stack.Screen name="archived" options={{ headerLargeTitle: true, title: "Archived" }} />
      <Stack.Screen name="[domain]" options={{ headerLargeTitle: true, title: "Domain" }} />
    </Stack>
  );
}
