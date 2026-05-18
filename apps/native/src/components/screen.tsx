import type { Ref } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RefreshControl } from "./refresh-control";

// Padding lives on the scroll content container (not an inner View) so card
// shadows aren't clipped at the edges and safe-area insets compose correctly
// with `contentInsetAdjustmentBehavior="automatic"`.
const CONTENT_STYLE = {
  paddingBottom: 32,
  paddingHorizontal: 16,
  paddingTop: 12,
  rowGap: 20,
} as const;

export function Screen({
  children,
  onRefresh,
  scroll = true,
  scrollRef,
}: {
  children: React.ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  scroll?: boolean;
  scrollRef?: Ref<ScrollView>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (!scroll) {
    // Non-scroll screens (e.g. the full-screen VersionGate block) must still
    // respect the notch / home indicator — there's no navigator inset here.
    return (
      <View
        className="flex-1 gap-5 bg-background px-4"
        style={{ paddingBottom: insets.bottom + 32, paddingTop: insets.top + 12 }}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      alwaysBounceVertical={Boolean(onRefresh)}
      className="flex-1 bg-background"
      contentContainerStyle={CONTENT_STYLE}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      refreshControl={
        onRefresh ? <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
