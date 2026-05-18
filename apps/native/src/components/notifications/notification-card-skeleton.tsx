import Animated from "react-native-reanimated";

import { Card } from "@/components/card";
import { usePulseStyle } from "@/lib/use-pulse-style";

function NotificationCardSkeleton() {
  const pulseStyle = usePulseStyle();
  return (
    <Card>
      <Animated.View className="flex-row items-start gap-3" style={pulseStyle}>
        <Animated.View className="size-9 rounded-full bg-secondary" />
        <Animated.View className="flex-1 gap-2">
          <Animated.View className="h-4 w-2/3 rounded bg-secondary" />
          <Animated.View className="h-4 w-full rounded bg-secondary" />
          <Animated.View className="h-3 w-24 rounded bg-secondary" />
        </Animated.View>
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
