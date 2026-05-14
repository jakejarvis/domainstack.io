import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

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
          className="border-line bg-glass h-24 rounded-2xl border"
          key={index}
          style={{ borderCurve: "continuous" }}
        />
      ))}
    </Animated.View>
  );
}
