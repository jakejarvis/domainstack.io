import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { cn } from "@/lib/cn";

export function Screen({
  children,
  className,
  onRefresh,
  scroll = true,
}: {
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => Promise<unknown> | void;
  scroll?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const body = <View className={cn("gap-5 px-4 pt-3 pb-8", className)}>{children}</View>;

  if (!scroll) {
    return <View className="bg-canvas flex-1">{body}</View>;
  }

  return (
    <ScrollView
      alwaysBounceVertical={Boolean(onRefresh)}
      className="bg-canvas flex-1"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} /> : undefined
      }
    >
      {body}
    </ScrollView>
  );
}
