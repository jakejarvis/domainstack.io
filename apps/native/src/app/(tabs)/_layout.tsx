import { useQuery } from "@tanstack/react-query";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { useCSSVariable } from "@/tw";

function formatBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  if (count > 99) return "99+";
  return String(count);
}

export default function TabsLayout() {
  const accent = useCSSVariable("--color-brand");
  const canvas = useCSSVariable("--color-canvas");
  const surface = useCSSVariable("--color-glass");
  const textMuted = useCSSVariable("--color-text-secondary");

  const trpc = useTRPC();
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);
  const unreadQuery = useQuery(
    trpc.notifications.unreadCount.queryOptions(undefined, { enabled: isSignedIn }),
  );
  const unreadBadge = formatBadge(unreadQuery.data ?? 0);

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
      <NativeTabs.Trigger contentStyle={{ backgroundColor: canvas }} name="notifications">
        <NativeTabs.Trigger.Icon
          md="notifications"
          sf={{ default: "bell", selected: "bell.fill" }}
        />
        <NativeTabs.Trigger.Label>Notifications</NativeTabs.Trigger.Label>
        {unreadBadge && <NativeTabs.Trigger.Badge>{unreadBadge}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={{ backgroundColor: canvas }} name="search">
        <NativeTabs.Trigger.Icon md="search" sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
