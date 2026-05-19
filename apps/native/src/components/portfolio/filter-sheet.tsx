import { type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Ref } from "react";
import { ScrollView, View } from "react-native";

import { AppBottomSheet, type AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { FilterOptionRow, FilterSection } from "@/components/portfolio/filter-section";
import { Text } from "@/components/text";
import type { PortfolioStatusFilter } from "@/lib/portfolio";
import { HEALTH_OPTIONS, STATUS_OPTIONS } from "@/lib/portfolio-filters";
import { type HealthBucket, usePortfolioStore } from "@/lib/stores/portfolio-store";

// `portfolio-filters.ts` stays macro-free (it has a non-transpiled unit test),
// so the localized labels live here, keyed by the lib's stable filter values.
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
  const { t, i18n } = useLingui();

  const healthCount = health.length;
  const tldCount = tlds.length;
  const tldOptionCount = availableTlds.length;
  const healthSummary = healthCount > 0 ? t`${healthCount} selected` : undefined;
  const tldSummary = tldCount > 0 ? t`${tldCount} selected` : undefined;
  const statusSummary = status === "all" ? undefined : i18n._(STATUS_LABELS[status]);

  return (
    <AppBottomSheet
      description={t`Combine filters to narrow your portfolio.`}
      ref={ref}
      title={t`Filter`}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <FilterSection summary={statusSummary} title={t`Status`}>
          {STATUS_OPTIONS.map((option) => (
            <FilterOptionRow
              key={option.value}
              label={i18n._(STATUS_LABELS[option.value])}
              onPress={() => setStatus(option.value as PortfolioStatusFilter)}
              selected={status === option.value}
              variant="radio"
            />
          ))}
        </FilterSection>

        <FilterSection summary={healthSummary} title={t`Health`}>
          {HEALTH_OPTIONS.map((option) => (
            <FilterOptionRow
              key={option.value}
              label={i18n._(HEALTH_LABELS[option.value])}
              onPress={() => toggleHealth(option.value as HealthBucket)}
              selected={health.includes(option.value)}
            />
          ))}
        </FilterSection>

        <FilterSection
          defaultExpanded={false}
          summary={tldSummary ?? t`${tldOptionCount} options`}
          title={t`Top-level domain`}
        >
          {availableTlds.length === 0 ? (
            <Text className="py-2 text-sm text-muted-foreground">
              <Trans>No TLDs yet. Add domains to your portfolio first.</Trans>
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
          <Text>
            <Trans>Reset</Trans>
          </Text>
        </Button>
      </View>
    </AppBottomSheet>
  );
}
