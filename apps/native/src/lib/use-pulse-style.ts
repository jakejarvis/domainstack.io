import { useEffect } from "react";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PULSE_DURATION = 900;

/**
 * Shared skeleton pulse. Honors the OS "Reduce Motion" setting: instead of an
 * infinite opacity loop it renders a calm, static dimmed placeholder.
 *
 * Single source of truth so skeleton.tsx and notification-card-skeleton.tsx
 * don't each carry a copy.
 */
export function usePulseStyle() {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 0.8 : 0.6);

  useEffect(() => {
    if (reduceMotion) {
      progress.set(0.8);
      return;
    }
    progress.set(
      withRepeat(
        withTiming(1, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [progress, reduceMotion]);

  return useAnimatedStyle(() => ({ opacity: progress.get() }));
}
