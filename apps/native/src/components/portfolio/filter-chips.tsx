import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
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
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;

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
            <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5">
              <Text className="text-xs font-semibold">{chip.label}</Text>
              <Symbol color={mutedColor} name={{ android: "close", ios: "xmark" }} size={11} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {chips.length > 1 ? (
        <Pressable accessibilityRole="button" hitSlop={6} onPress={resetFilters}>
          <Text className="text-xs font-semibold text-muted-foreground">Clear</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
