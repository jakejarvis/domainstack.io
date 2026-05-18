import Animated from "react-native-reanimated";

import { Card } from "@/components/card";
import { usePulseStyle } from "@/lib/use-pulse-style";

function NotificationCardSkeleton() {
  const pulseStyle = usePulseStyle();
  return (
    <Card>
      <Animated.View className="gap-2" style={pulseStyle}>
        <Animated.View className="flex-row items-start justify-between gap-3">
          <Animated.View className="h-5 w-2/3 rounded bg-secondary" />
          <Animated.View className="h-5 w-12 rounded-full bg-secondary" />
        </Animated.View>
        <Animated.View className="h-4 w-full rounded bg-secondary" />
        <Animated.View className="h-4 w-5/6 rounded bg-secondary" />
        <Animated.View className="h-3 w-24 rounded bg-secondary" />
      </Animated.View>
    </Card>
  );
}

export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Animated.View
      accessibilityElementsHidden
      className="gap-3"
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => ({ key: `notif-skeleton-${i}` })).map((row) => (
        <NotificationCardSkeleton key={row.key} />
      ))}
    </Animated.View>
  );
}
