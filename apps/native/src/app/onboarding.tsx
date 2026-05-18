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
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { Symbol, type SymbolName } from "@/components/symbol";
import { Text } from "@/components/text";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

interface Slide {
  icon: SymbolName;
  title: string;
  body: string;
}

const SLIDES: readonly Slide[] = [
  {
    icon: { ios: "magnifyingglass", android: "search" },
    title: "Search any domain",
    body: "Look up registration, DNS, SSL, hosting, and SEO for any domain on the public internet.",
  },
  {
    icon: { ios: "bookmark", android: "bookmark" },
    title: "Track your portfolio",
    body: "Add domains you own to get a continuously refreshed view of every change that matters.",
  },
  {
    icon: { ios: "bell", android: "notifications" },
    title: "Get notified",
    body: "We'll push and email you before registrations or certificates expire, or when providers change.",
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
  const style = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP),
      width: interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP),
    };
  });

  return <Animated.View className="h-2 rounded-full" style={[{ backgroundColor: color }, style]} />;
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const iconColor = useCSSVariable("--color-brand") as string;
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
          accessibilityRole="button"
          className="px-4 py-2"
          hitSlop={{ bottom: 16, left: 16, right: 16, top: 16 }}
          onPress={goSearch}
        >
          <Text className="text-sm font-semibold text-muted-foreground">Skip</Text>
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
          <View key={slide.title} className="items-center justify-center px-8" style={{ width }}>
            <View className="mb-6 size-24 items-center justify-center rounded-full bg-secondary">
              <Symbol name={slide.icon} size={56} color={iconColor} />
            </View>
            <Text variant="title" className="mb-3 text-center">
              {slide.title}
            </Text>
            <Text className="text-center text-base leading-6 text-muted-foreground">
              {slide.body}
            </Text>
          </View>
        ))}
      </Animated.ScrollView>

      <View className="flex-row items-center justify-center gap-2 py-4">
        {SLIDES.map((slide, i) => (
          <Dot color={iconColor} index={i} key={slide.title} scrollX={scrollX} width={width} />
        ))}
      </View>

      <View className="gap-2 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button onPress={goSignIn}>
          <Text>Sign in</Text>
        </Button>
        <Button onPress={goSearch} variant="secondary">
          <Text>Maybe later</Text>
        </Button>
      </View>
    </View>
  );
}
