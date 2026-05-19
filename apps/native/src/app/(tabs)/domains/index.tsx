import { Trans, useLingui } from "@lingui/react/macro";
import { FlashList } from "@shopify/flash-list";
import { useIsRestoring, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { Platform, View } from "react-native";

import type { AppBottomSheetRef } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { HeaderMenu } from "@/components/header-menu";
import { BulkActionsToolbar } from "@/components/portfolio/bulk-actions-toolbar";
import { CalendarFeedSheet } from "@/components/portfolio/calendar-feed-sheet";
import { FilterChips } from "@/components/portfolio/filter-chips";
import { FilterSheet } from "@/components/portfolio/filter-sheet";
import { QuotaMeter } from "@/components/portfolio/quota-meter";
import { SubscriptionBanner } from "@/components/portfolio/subscription-banner";
import { SwipeableRow } from "@/components/portfolio/swipeable-row";
import { QueryErrorState } from "@/components/query-error-state";
import { RefreshControl } from "@/components/refresh-control";
import { RequireAuth } from "@/components/require-auth";
import { Screen } from "@/components/screen";
import { type ErrorBoundaryProps, ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { SegmentedControl } from "@/components/segmented-control";
import { PortfolioListSkeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useSelectionMode } from "@/hooks/use-portfolio-selection";
import { useTRPC } from "@/lib/api";
import { type PortfolioDomain, type PortfolioSort, sortPortfolioDomains } from "@/lib/portfolio";
import { activeFilterCount, applyFilters, availableTldsFrom } from "@/lib/portfolio-filters";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";

export default function DomainsScreen() {
  const { t } = useLingui();
  return (
    <RequireAuth
      body={t`Track ownership, expiry, providers, and notifications. Search stays available without an account; your portfolio syncs after sign in.`}
      header={<HeaderMenu />}
      loading={<PortfolioListSkeleton count={4} />}
      title={t`Portfolio is locked`}
    >
      <PortfolioScreen />
    </RequireAuth>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const { t } = useLingui();
  return <ScreenErrorBoundary {...props} title={t`Couldn’t load your portfolio`} />;
}

function PortfolioScreen() {
  const { t } = useLingui();
  const sorts: Array<{ label: string; value: PortfolioSort }> = [
    { label: t`Name`, value: "name" },
    { label: t`Expiry`, value: "expiry" },
    { label: t`Recent`, value: "created" },
  ];
  const trpc = useTRPC();
  const navigation = useNavigation();
  const dashboard = useDashboardMutations();
  const hasHydrated = usePortfolioStore((state) => state.hasHydrated);
  const query = usePortfolioStore((state) => state.query);
  const sort = usePortfolioStore((state) => state.sort);
  const status = usePortfolioStore((state) => state.status);
  const health = usePortfolioStore((state) => state.health);
  const tlds = usePortfolioStore((state) => state.tlds);
  const setQuery = usePortfolioStore((state) => state.setQuery);
  const setSort = usePortfolioStore((state) => state.setSort);
  const selectionMode = useSelectionMode();
  const selectionCount = usePortfolioStore((state) => state.selection.ids.size);
  const [refreshing, setRefreshing] = useState(false);

  const filterSheetRef = useRef<AppBottomSheetRef | null>(null);
  const calendarSheetRef = useRef<AppBottomSheetRef | null>(null);

  const isRestoring = useIsRestoring();
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions({ includeArchived: false }));
  const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        hideWhenScrolling: true,
        onChangeText: (event: NativeSyntheticEvent<{ text: string }>) =>
          setQuery(event.nativeEvent.text),
        placeholder: t`Filter domains`,
      },
      title: selectionMode === "selecting" ? t`${selectionCount} selected` : t`Portfolio`,
    });
  }, [navigation, selectionCount, selectionMode, setQuery, t]);

  const domains = useMemo<PortfolioDomain[]>(() => {
    return (domainsQuery.data ?? []).map((item) => ({
      archivedAt: item.archivedAt,
      ca: item.ca ?? null,
      createdAt: item.createdAt,
      dns: item.dns ?? null,
      domainName: item.domainName,
      email: item.email ?? null,
      expirationDate: item.expirationDate,
      hosting: item.hosting ?? null,
      id: item.id,
      muted: item.muted,
      registrar: item.registrar ?? null,
      verified: item.verified,
    }));
  }, [domainsQuery.data]);

  const availableTlds = useMemo(() => availableTldsFrom(domains), [domains]);

  const visibleDomains = useMemo(
    () => sortPortfolioDomains(applyFilters(domains, { health, status, tlds }, query), sort),
    [domains, health, status, tlds, query, sort],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([domainsQuery.refetch(), subscriptionQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [domainsQuery, subscriptionQuery]);

  const handleRowPress = useCallback((domain: PortfolioDomain) => {
    const state = usePortfolioStore.getState();
    if (state.selection.mode === "selecting") {
      if (process.env.EXPO_OS !== "web") void Haptics.selectionAsync();
      state.toggle(domain.id);
      return;
    }
    router.push({
      params: { domain: domain.domainName },
      pathname: "/(tabs)/domains/[domain]",
    });
  }, []);

  const handleRowLongPress = useCallback((domain: PortfolioDomain) => {
    const state = usePortfolioStore.getState();
    if (state.selection.mode === "selecting") {
      if (process.env.EXPO_OS !== "web") void Haptics.selectionAsync();
      state.toggle(domain.id);
    } else {
      if (process.env.EXPO_OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      state.enterSelection(domain.id);
    }
  }, []);

  const handleArchive = useCallback(
    (domain: PortfolioDomain) => {
      void dashboard.archive(domain.id);
    },
    [dashboard],
  );

  const handleMute = useCallback(
    (domain: PortfolioDomain) => {
      void dashboard.setMuted(domain.id, !domain.muted);
    },
    [dashboard],
  );

  const renderItem = useCallback(
    ({ item }: { item: PortfolioDomain }) => (
      <SwipeableRow
        domain={item}
        onArchive={handleArchive}
        onLongPress={handleRowLongPress}
        onMute={handleMute}
        onPress={handleRowPress}
      />
    ),
    [handleArchive, handleMute, handleRowLongPress, handleRowPress],
  );

  const subscription = subscriptionQuery.data;
  const isSelecting = selectionMode === "selecting";
  const archivedCount = subscription?.archivedCount ?? 0;
  const filterCount = activeFilterCount({ health, status, tlds });
  const isFiltering = filterCount > 0 || Boolean(query);
  // Treat pre-hydration AND the persisted-cache restore as loading so we never
  // flash a default-sorted or stale-from-disk list before either settles.
  const isLoading = !hasHydrated || isRestoring || domainsQuery.isPending;

  // Loading/error replace the interactive chrome entirely — never render
  // QuotaMeter/filters/sort over a skeleton (CLS + tappable empty controls).
  if (isLoading) {
    return (
      <Screen>
        <HeaderMenu />
        <PortfolioListSkeleton count={6} />
      </Screen>
    );
  }

  if (domainsQuery.error) {
    return (
      <Screen>
        <HeaderMenu />
        <QueryErrorState
          onRetry={() => void domainsQuery.refetch()}
          title={t`Couldn’t load your portfolio`}
        />
      </Screen>
    );
  }

  const listHeader = (
    <View className="gap-4 px-4 pt-3 pb-2">
      <HeaderMenu
        leading={
          <Stack.Toolbar.Button
            accessibilityLabel={t`Open filters`}
            icon={Platform.OS === "ios" ? "line.3.horizontal.decrease.circle" : undefined}
            onPress={() => filterSheetRef.current?.present()}
          >
            {Platform.OS === "android"
              ? filterCount > 0
                ? t`Filters (${filterCount})`
                : t`Filters`
              : undefined}
          </Stack.Toolbar.Button>
        }
      >
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "calendar.badge.clock" : undefined}
          onPress={() => calendarSheetRef.current?.present()}
        >
          {t`Calendar feed`}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "archivebox" : undefined}
          onPress={() => router.push("/(tabs)/domains/archived")}
        >
          {archivedCount > 0 ? t`Archived (${archivedCount})` : t`Archived`}
        </Stack.Toolbar.MenuAction>
      </HeaderMenu>

      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          onPress={() => {
            const store = usePortfolioStore.getState();
            if (store.selection.mode === "selecting") {
              store.exitSelection();
            } else {
              store.enterSelection();
            }
          }}
        >
          {isSelecting ? t`Cancel` : t`Edit`}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      {subscription ? (
        <QuotaMeter
          activeCount={subscription.activeCount}
          plan={subscription.plan}
          planQuota={subscription.planQuota}
        />
      ) : null}

      {subscription ? <SubscriptionBanner subscription={subscription} /> : null}

      <Button onPress={() => router.push("/(tabs)/domains/add")}>
        <Text>
          <Trans>Add domain</Trans>
        </Text>
      </Button>

      <FilterChips />

      <SegmentedControl onChange={setSort} options={sorts} value={sort} />
    </View>
  );

  const listEmpty = (
    <View className="px-4 pb-8">
      <EmptyState
        actionLabel={isFiltering ? undefined : t`Add domain`}
        body={
          isFiltering
            ? t`Try removing some filters or clearing the search bar.`
            : t`Add a domain to keep its registration, DNS, providers, and notifications close at hand.`
        }
        icon={
          isFiltering
            ? { android: "filter_list", ios: "line.3.horizontal.decrease.circle" }
            : { android: "language", ios: "globe" }
        }
        onAction={isFiltering ? undefined : () => router.push("/(tabs)/domains/add")}
        title={isFiltering ? t`No domains match` : t`No domains found`}
      />
    </View>
  );

  return (
    <View className="flex-1">
      <FlashList
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        data={visibleDomains}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
        renderItem={renderItem}
      />
      <BulkActionsToolbar />
      <FilterSheet availableTlds={availableTlds} ref={filterSheetRef} />
      <CalendarFeedSheet ref={calendarSheetRef} />
    </View>
  );
}

function keyExtractor(item: PortfolioDomain): string {
  return item.id;
}
