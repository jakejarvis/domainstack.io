import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useCSSVariable } from "@/tw";

export default function TabsLayout() {
  const accent = useCSSVariable("--color-brand");
  const canvas = useCSSVariable("--color-canvas");
  const surface = useCSSVariable("--color-glass");
  const textMuted = useCSSVariable("--color-text-secondary");

  return (
    <NativeTabs
      backgroundColor={surface}
      iconColor={{ default: textMuted, selected: accent }}
      labelStyle={{
        default: { color: textMuted },
        selected: { color: accent, fontWeight: "600" },
      }}
      minimizeBehavior="onScrollDown"
      tintColor={accent}
    >
      <NativeTabs.Trigger contentStyle={{ backgroundColor: canvas }} name="domains">
        <NativeTabs.Trigger.Icon
          md="language"
          sf={{ default: "globe", selected: "globe.americas.fill" }}
        />
        <NativeTabs.Trigger.Label>Portfolio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={{ backgroundColor: canvas }} name="alerts">
        <NativeTabs.Trigger.Icon
          md="notifications"
          sf={{ default: "bell", selected: "bell.fill" }}
        />
        <NativeTabs.Trigger.Label>Alerts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={{ backgroundColor: canvas }} name="search">
        <NativeTabs.Trigger.Icon md="search" sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
