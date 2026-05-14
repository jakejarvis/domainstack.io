import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/button";
import { MutedText, Text } from "@/components/text";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

type SlideName = "search" | "bookmark" | "notifications";

interface Slide {
  icon: SlideName;
  title: string;
  body: string;
}

const SLIDES: readonly Slide[] = [
  {
    icon: "search",
    title: "Search any domain",
    body: "Look up registration, DNS, SSL, hosting, and SEO for any domain on the public internet.",
  },
  {
    icon: "bookmark",
    title: "Track your portfolio",
    body: "Add domains you own to get a continuously refreshed view of every change that matters.",
  },
  {
    icon: "notifications",
    title: "Get notified",
    body: "We'll push and email you before registrations or certificates expire, or when providers change.",
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const [index, setIndex] = useState(0);
  const iconColor = useCSSVariable("--color-brand") as string;
  const mutedColor = useCSSVariable("--color-text-secondary") as string;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      if (next !== index) setIndex(next);
    },
    [index, width],
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
    <View className="bg-canvas flex-1" style={{ paddingTop: insets.top }}>
      <View className="flex-row justify-end px-4 py-2">
        <Pressable accessibilityRole="button" hitSlop={8} onPress={goSearch}>
          <Text className="text-text-secondary text-sm font-semibold">Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        className="flex-1"
      >
        {SLIDES.map((slide) => (
          <View key={slide.icon} className="items-center justify-center px-8" style={{ width }}>
            <View className="bg-control-secondary mb-6 size-24 items-center justify-center rounded-full">
              <MaterialIcons color={iconColor} name={slide.icon} size={56} />
            </View>
            <Text className="mb-3 text-center text-3xl font-semibold">{slide.title}</Text>
            <MutedText className="text-center text-base leading-6">{slide.body}</MutedText>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-center justify-center gap-2 py-4">
        {SLIDES.map((slide, i) => (
          <View
            key={slide.icon}
            className="h-2 rounded-full"
            style={{
              backgroundColor: i === index ? iconColor : mutedColor,
              opacity: i === index ? 1 : 0.4,
              width: i === index ? 24 : 8,
            }}
          />
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
