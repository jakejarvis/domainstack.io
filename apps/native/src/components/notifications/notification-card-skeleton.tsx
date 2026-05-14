import { View } from "react-native";

import { GlassCard } from "@/components/glass-card";

export function NotificationCardSkeleton() {
  return (
    <GlassCard>
      <View className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="bg-control-secondary h-5 w-2/3 rounded" />
          <View className="bg-control-secondary h-5 w-12 rounded-full" />
        </View>
        <View className="bg-control-secondary h-4 w-full rounded" />
        <View className="bg-control-secondary h-4 w-5/6 rounded" />
        <View className="bg-control-secondary h-3 w-24 rounded" />
      </View>
    </GlassCard>
  );
}

export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }, (_, index) => (
        <NotificationCardSkeleton key={index} />
      ))}
    </View>
  );
}
