import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/cn";

const PULSE_DURATION = 900;

function usePulseStyle() {
  const progress = useSharedValue(0.6);

  useEffect(() => {
    progress.set(
      withRepeat(
        withTiming(1, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [progress]);

  return useAnimatedStyle(() => ({ opacity: progress.get() }));
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  const pulseStyle = usePulseStyle();
  return (
    <Animated.View className="gap-3" style={pulseStyle}>
      {Array.from({ length: count }, (_, index) => (
        <Animated.View
          className="bg-glass h-24 rounded-2xl border border-border"
          key={index}
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
    <Animated.View className="gap-3" style={pulseStyle}>
      {Array.from({ length: count }, (_, index) => (
        <View
          className="gap-3 rounded-2xl border border-border bg-card p-4"
          key={index}
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
