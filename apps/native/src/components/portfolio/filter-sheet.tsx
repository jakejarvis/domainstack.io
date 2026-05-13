import type { Ref } from "react";
import { ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { FilterOptionRow, FilterSection } from "@/components/portfolio/filter-section";
import { Text } from "@/components/text";
import type { PortfolioStatusFilter } from "@/lib/portfolio";
import { HEALTH_OPTIONS, STATUS_OPTIONS } from "@/lib/portfolio-filters";
import { type HealthBucket, usePortfolioStore } from "@/lib/stores/portfolio-store";

export function FilterSheet({
  availableTlds,
  ref,
}: {
  availableTlds: string[];
  ref?: Ref<AppBottomSheetRef>;
}) {
  const status = usePortfolioStore((state) => state.status);
  const health = usePortfolioStore((state) => state.health);
  const tlds = usePortfolioStore((state) => state.tlds);
  const setStatus = usePortfolioStore((state) => state.setStatus);
  const toggleHealth = usePortfolioStore((state) => state.toggleHealth);
  const toggleTld = usePortfolioStore((state) => state.toggleTld);
  const resetFilters = usePortfolioStore((state) => state.resetFilters);

  const healthSummary = health.length > 0 ? `${health.length} selected` : undefined;
  const tldSummary = tlds.length > 0 ? `${tlds.length} selected` : undefined;
  const statusSummary =
    status === "all" ? undefined : STATUS_OPTIONS.find((s) => s.value === status)?.label;

  return (
    <AppBottomSheet
      description="Combine filters to narrow your portfolio."
      ref={ref}
      title="Filter"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSection summary={statusSummary} title="Status">
          {STATUS_OPTIONS.map((option) => (
            <FilterOptionRow
              key={option.value}
              label={option.label}
              onPress={() => setStatus(option.value as PortfolioStatusFilter)}
              selected={status === option.value}
              variant="radio"
            />
          ))}
        </FilterSection>

        <FilterSection summary={healthSummary} title="Health">
          {HEALTH_OPTIONS.map((option) => (
            <FilterOptionRow
              key={option.value}
              label={option.label}
              onPress={() => toggleHealth(option.value as HealthBucket)}
              selected={health.includes(option.value)}
            />
          ))}
        </FilterSection>

        <FilterSection
          defaultExpanded={false}
          summary={tldSummary ?? `${availableTlds.length} options`}
          title="Top-level domain"
        >
          {availableTlds.length === 0 ? (
            <Text className="text-text-secondary py-2 text-sm">
              No TLDs yet — add domains to your portfolio first.
            </Text>
          ) : (
            availableTlds.map((tld) => (
              <FilterOptionRow
                key={tld}
                label={`.${tld}`}
                onPress={() => toggleTld(tld)}
                selected={tlds.includes(tld)}
              />
            ))
          )}
        </FilterSection>
      </ScrollView>

      <View className="flex-row gap-2">
        <Button className="flex-1" onPress={resetFilters} variant="secondary">
          <Text>Reset</Text>
        </Button>
      </View>
    </AppBottomSheet>
  );
}
