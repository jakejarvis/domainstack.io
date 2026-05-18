import { Stack } from "expo-router/stack";

import { useStackScreenOptions } from "@/lib/screen-options";

export default function NotificationsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: "Notifications" }} />
    </Stack>
  );
}
