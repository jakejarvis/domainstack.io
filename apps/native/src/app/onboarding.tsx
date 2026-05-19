import { type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useRef } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { Symbol, type SymbolName } from "@/components/symbol";
import { Text } from "@/components/text";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

interface Slide {
  id: string;
  icon: SymbolName;
  title: MessageDescriptor;
  body: MessageDescriptor;
}

const SLIDES: readonly Slide[] = [
  {
    id: "search",
    icon: { ios: "magnifyingglass", android: "search" },
    title: msg`Search any domain`,
    body: msg`Look up registration, DNS, SSL, hosting, and SEO for any domain on the public internet.`,
  },
  {
    id: "portfolio",
    icon: { ios: "bookmark", android: "bookmark" },
    title: msg`Track your portfolio`,
    body: msg`Add domains you own to get a continuously refreshed view of every change that matters.`,
  },
  {
    id: "notify",
    icon: { ios: "bell", android: "notifications" },
    title: msg`Get notified`,
    body: msg`We’ll push and email you before registrations or certificates expire, or when providers change.`,
  },
];

function Dot({
  index,
  scrollX,
  width,
  color,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  color: string;
}) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => {
    // Reduced motion: snap the active indicator discretely instead of morphing
    // width/opacity as the carousel scrolls.
    if (reduceMotion) {
      const active = Math.round(scrollX.value / width) === index;
      return { opacity: active ? 1 : 0.3, width: active ? 24 : 8 };
    }
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP),
      width: interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP),
    };
  });

  return <Animated.View className="h-2 rounded-full" style={[{ backgroundColor: color }, style]} />;
}

export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";

export default function OnboardingScreen() {
  const { t } = useLingui();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const iconColor = useCSSVariable("--color-brand") as string;
  const accentBlue = useCSSVariable("--color-accent-blue") as string;
  const accentPurple = useCSSVariable("--color-accent-purple") as string;
  const scrollX = useSharedValue(0);
  const pageRef = useRef(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      if (page !== pageRef.current) {
        pageRef.current = page;
        if (process.env.EXPO_OS !== "web") void Haptics.selectionAsync();
      }
    },
    [width],
  );

  const goSignIn = useCallback(() => {
    markSeen();
    router.replace("/sign-in");
  }, [markSeen]);

  const goSearch = useCallback(() => {
    markSeen();
    router.replace("/(tabs)/search");
  }, [markSeen]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row justify-end px-2 py-1">
        <Pressable
          accessibilityLabel={t`Skip onboarding`}
          accessibilityRole="button"
          className="px-4 py-2"
          hitSlop={{ bottom: 16, left: 16, right: 16, top: 16 }}
          onPress={goSearch}
        >
          <Text className="text-sm font-semibold text-muted-foreground">
            <Trans>Skip</Trans>
          </Text>
        </Pressable>
      </View>

      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} className="items-center justify-center px-8" style={{ width }}>
            <View
              className="mb-8 size-52 items-center justify-center overflow-hidden rounded-[36px]"
              style={{ borderCurve: "continuous" }}
            >
              <View
                pointerEvents="none"
                style={{
                  bottom: 0,
                  experimental_backgroundImage: `linear-gradient(155deg, ${accentBlue}, ${accentPurple})`,
                  left: 0,
                  opacity: 0.16,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  backgroundColor: accentPurple,
                  borderRadius: 999,
                  boxShadow: `0 0 44px 12px ${accentPurple}`,
                  height: 64,
                  left: 28,
                  opacity: 0.4,
                  position: "absolute",
                  right: 28,
                  top: -12,
                }}
              />
              <View
                className="size-36 items-center justify-center rounded-3xl border border-border bg-card"
                style={{ borderCurve: "continuous" }}
              >
                <Symbol name={slide.icon} size={60} color={iconColor} />
              </View>
            </View>
            <Text variant="title" className="mb-3 text-center">
              {t(slide.title)}
            </Text>
            <Text className="text-center text-base leading-6 text-muted-foreground">
              {t(slide.body)}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>

      <View className="flex-row items-center justify-center gap-2 py-4">
        {SLIDES.map((slide, i) => (
          <Dot color={iconColor} index={i} key={slide.id} scrollX={scrollX} width={width} />
        ))}
      </View>

      <View className="gap-2 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button onPress={goSignIn}>
          <Text>
            <Trans>Sign in</Trans>
          </Text>
        </Button>
        <Button onPress={goSearch} variant="secondary">
          <Text>
            <Trans>Maybe later</Trans>
          </Text>
        </Button>
      </View>
    </View>
  );
}
