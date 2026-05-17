import type { Ref } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { cn } from "@/lib/cn";

import { RefreshControl } from "./refresh-control";

export function Screen({
  children,
  className,
  onRefresh,
  scroll = true,
  scrollRef,
}: {
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => Promise<unknown> | void;
  scroll?: boolean;
  scrollRef?: Ref<ScrollView>;
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
    return <View className="flex-1 bg-background">{body}</View>;
  }

  return (
    <ScrollView
      alwaysBounceVertical={Boolean(onRefresh)}
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      refreshControl={
        onRefresh ? <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} /> : undefined
      }
    >
      {body}
    </ScrollView>
  );
}
