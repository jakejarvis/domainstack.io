import { View } from "react-native";
import Animated from "react-native-reanimated";

import { cn } from "@/lib/cn";
import { usePulseStyle } from "@/lib/use-pulse-style";

export function SkeletonRows({ count = 3 }: { count?: number }) {
  const pulseStyle = usePulseStyle();
  return (
    <Animated.View
      accessibilityElementsHidden
      className="gap-3"
      importantForAccessibility="no-hide-descendants"
      style={pulseStyle}
    >
      {Array.from({ length: count }, (_, i) => ({ key: `skeleton-row-${i}` })).map((row) => (
        <Animated.View
          className="bg-glass h-24 rounded-2xl border border-border"
          key={row.key}
          style={{ borderCurve: "continuous" }}
        />
      ))}
    </Animated.View>
  );
}

function Bar({ className }: { className?: string }) {
  return <View className={cn("h-3.5 rounded-md bg-secondary", className)} />;
}

/**
 * Mirrors a {@link DomainRow} card (title + expiry line + provider chips) so
 * the portfolio doesn't shift layout when real data resolves.
 */
export function PortfolioListSkeleton({ count = 5 }: { count?: number }) {
  const pulseStyle = usePulseStyle();
  return (
    <Animated.View
      accessibilityElementsHidden
      className="gap-3"
      importantForAccessibility="no-hide-descendants"
      style={pulseStyle}
    >
      {Array.from({ length: count }, (_, i) => ({ key: `portfolio-skeleton-${i}` })).map((row) => (
        <View
          className="gap-3 rounded-2xl border border-border bg-card p-4"
          key={row.key}
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Bar className="h-5 w-2/5" />
            <View className="h-6 w-16 rounded-full bg-secondary" />
          </View>
          <Bar className="w-1/2" />
          <View className="flex-row gap-2">
            <View className="h-6 w-20 rounded-full bg-secondary" />
            <View className="h-6 w-16 rounded-full bg-secondary" />
            <View className="h-6 w-24 rounded-full bg-secondary" />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
