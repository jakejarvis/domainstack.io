import { type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Symbol } from "@/components/symbol";
import { Text } from "@/components/text";
import type { PortfolioStatusFilter } from "@/lib/portfolio";
import { buildChips, type FilterChip } from "@/lib/portfolio-filters";
import { type HealthBucket, usePortfolioStore } from "@/lib/stores/portfolio-store";

// `portfolio-filters.ts` is intentionally macro-free (it has a non-transpiled
// unit test), so localized labels are resolved here from the chip's stable
// `key` (`status:<v>` / `health:<v>` / `tld:<v>`).
const STATUS_LABELS: Record<PortfolioStatusFilter, MessageDescriptor> = {
  all: msg`All`,
  verified: msg`Verified`,
  "needs-verification": msg`Needs verification`,
  muted: msg`Muted`,
};

const HEALTH_LABELS: Record<HealthBucket, MessageDescriptor> = {
  healthy: msg`Healthy`,
  expiring: msg`Expiring soon`,
  expired: msg`Expired`,
};

function localizedChipLabel(chip: FilterChip, i18n: I18n): string {
  const sep = chip.key.indexOf(":");
  const prefix = chip.key.slice(0, sep);
  const value = chip.key.slice(sep + 1);
  if (prefix === "status" && value in STATUS_LABELS) {
    return i18n._(STATUS_LABELS[value as PortfolioStatusFilter]);
  }
  if (prefix === "health" && value in HEALTH_LABELS) {
    return i18n._(HEALTH_LABELS[value as HealthBucket]);
  }
  // tld chips are `.com` etc. — not translatable.
  return chip.label;
}

export function FilterChips() {
  const status = usePortfolioStore((state) => state.status);
  const health = usePortfolioStore((state) => state.health);
  const tlds = usePortfolioStore((state) => state.tlds);
  const setStatus = usePortfolioStore((state) => state.setStatus);
  const toggleHealth = usePortfolioStore((state) => state.toggleHealth);
  const toggleTld = usePortfolioStore((state) => state.toggleTld);
  const resetFilters = usePortfolioStore((state) => state.resetFilters);
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { t, i18n } = useLingui();

  const chips = useMemo<FilterChip[]>(
    () => buildChips({ health, status, tlds }, { setStatus, toggleHealth, toggleTld }),
    [health, setStatus, status, tlds, toggleHealth, toggleTld],
  );

  if (chips.length === 0) return null;

  return (
    <Animated.View
      className="flex-row items-center gap-2"
      entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ alignItems: "center", gap: 8 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips.map((chip) => {
          const label = localizedChipLabel(chip, i18n);
          return (
            <Pressable
              accessibilityLabel={t`Remove ${label} filter`}
              accessibilityRole="button"
              hitSlop={{ bottom: 10, left: 6, right: 6, top: 10 }}
              key={chip.key}
              onPress={chip.remove}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5">
                <Text className="text-xs font-semibold">{label}</Text>
                <Symbol color={mutedColor} name={{ android: "close", ios: "xmark" }} size={11} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {chips.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={{ bottom: 12, left: 12, right: 12, top: 12 }}
          onPress={resetFilters}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text className="text-xs font-semibold text-muted-foreground">
            <Trans>Clear</Trans>
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
