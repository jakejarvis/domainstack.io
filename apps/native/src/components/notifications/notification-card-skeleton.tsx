import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { GlassCard } from "@/components/glass-card";

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

function NotificationCardSkeleton() {
  const pulseStyle = usePulseStyle();
  return (
    <GlassCard>
      <Animated.View className="gap-2" style={pulseStyle}>
        <Animated.View className="flex-row items-start justify-between gap-3">
          <Animated.View className="bg-control-secondary h-5 w-2/3 rounded" />
          <Animated.View className="bg-control-secondary h-5 w-12 rounded-full" />
        </Animated.View>
        <Animated.View className="bg-control-secondary h-4 w-full rounded" />
        <Animated.View className="bg-control-secondary h-4 w-5/6 rounded" />
        <Animated.View className="bg-control-secondary h-3 w-24 rounded" />
      </Animated.View>
    </GlassCard>
  );
}

export function NotificationListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Animated.View className="gap-3">
      {Array.from({ length: count }, (_, index) => (
        <NotificationCardSkeleton key={index} />
      ))}
    </Animated.View>
  );
}
