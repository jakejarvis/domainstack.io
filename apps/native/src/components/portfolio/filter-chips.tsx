import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { MutedText, Text } from "@/components/text";
import { buildChips, type FilterChip } from "@/lib/portfolio-filters";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";

export function FilterChips() {
  const status = usePortfolioStore((state) => state.status);
  const health = usePortfolioStore((state) => state.health);
  const tlds = usePortfolioStore((state) => state.tlds);
  const setStatus = usePortfolioStore((state) => state.setStatus);
  const toggleHealth = usePortfolioStore((state) => state.toggleHealth);
  const toggleTld = usePortfolioStore((state) => state.toggleTld);
  const resetFilters = usePortfolioStore((state) => state.resetFilters);

  const chips = useMemo<FilterChip[]>(
    () => buildChips({ health, status, tlds }, { setStatus, toggleHealth, toggleTld }),
    [health, setStatus, status, tlds, toggleHealth, toggleTld],
  );

  if (chips.length === 0) return null;

  return (
    <Animated.View
      className="flex-row items-center gap-2"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(140)}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ alignItems: "center", gap: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips.map((chip) => (
          <Pressable
            accessibilityLabel={`Remove ${chip.label} filter`}
            accessibilityRole="button"
            hitSlop={4}
            key={chip.key}
            onPress={chip.remove}
          >
            <View className="bg-control-secondary border-line flex-row items-center gap-1.5 rounded-full border px-3 py-1.5">
              <Text className="text-xs font-semibold">{chip.label}</Text>
              <Text className="text-text-secondary text-xs">✕</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {chips.length > 1 ? (
        <Pressable accessibilityRole="button" hitSlop={6} onPress={resetFilters}>
          <MutedText className="text-xs font-semibold">Clear</MutedText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
