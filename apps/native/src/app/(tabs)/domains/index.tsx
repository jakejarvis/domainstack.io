import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
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
import { RefreshControl } from "@/components/refresh-control";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useSelectionMode } from "@/hooks/use-portfolio-selection";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { type PortfolioDomain, type PortfolioSort, sortPortfolioDomains } from "@/lib/portfolio";
import { activeFilterCount, applyFilters, availableTldsFrom } from "@/lib/portfolio-filters";
import { usePortfolioStore } from "@/lib/stores/portfolio-store";

const sorts: Array<{ label: string; value: PortfolioSort }> = [
  { label: "Name", value: "name" },
  { label: "Expiry", value: "expiry" },
  { label: "Recent", value: "created" },
];

export default function DomainsScreen() {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        <HeaderMenu />
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        <HeaderMenu />
        <MutedText>Sign in to track ownership, expiry, providers, and notifications.</MutedText>
        <EmptyState
          actionLabel="Sign in"
          body="Search remains available without an account. Your portfolio syncs after sign in."
          onAction={() => router.push("/sign-in")}
          title="Portfolio is locked"
        />
      </Screen>
    );
  }

  return <PortfolioScreen />;
}

function PortfolioScreen() {
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

  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions({ includeArchived: false }));
  const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        hideWhenScrolling: false,
        onChangeText: (event: NativeSyntheticEvent<{ text: string }>) =>
          setQuery(event.nativeEvent.text),
        placeholder: "Filter domains",
      },
      title: selectionMode === "selecting" ? `${selectionCount} selected` : "Portfolio",
    });
  }, [navigation, selectionCount, selectionMode, setQuery]);

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
      state.toggle(domain.id);
    } else {
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
  // Treat pre-hydration as loading so we don't flash a default-sorted list
  // before AsyncStorage restores the user's persisted sort.
  const isLoading = !hasHydrated || domainsQuery.isPending;

  const listHeader = (
    <View className="gap-4 px-4 pt-3 pb-2">
      <HeaderMenu
        leading={
          <Stack.Toolbar.Button
            accessibilityLabel="Open filters"
            icon={Platform.OS === "ios" ? "line.3.horizontal.decrease.circle" : undefined}
            onPress={() => filterSheetRef.current?.present()}
          >
            {Platform.OS === "android"
              ? filterCount > 0
                ? `Filters (${filterCount})`
                : "Filters"
              : undefined}
          </Stack.Toolbar.Button>
        }
      >
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "calendar.badge.clock" : undefined}
          onPress={() => calendarSheetRef.current?.present()}
        >
          Calendar feed
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "archivebox" : undefined}
          onPress={() => router.push("/(tabs)/domains/archived")}
        >
          {archivedCount > 0 ? `Archived (${archivedCount})` : "Archived"}
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
          {isSelecting ? "Cancel" : "Edit"}
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
        <Text>Add domain</Text>
      </Button>

      <FilterChips />

      <SegmentedControl onChange={setSort} options={sorts} value={sort} />

      {isLoading ? <SkeletonRows /> : null}

      {domainsQuery.error ? (
        <EmptyState
          actionLabel="Retry"
          body={domainsQuery.error.message}
          onAction={() => void domainsQuery.refetch()}
          title="Domains did not load"
        />
      ) : null}
    </View>
  );

  const listEmpty =
    !isLoading && !domainsQuery.error ? (
      <View className="px-4 pb-8">
        <EmptyState
          actionLabel={filterCount > 0 || query ? undefined : "Add domain"}
          body={
            filterCount > 0 || query
              ? "Try removing some filters or clearing the search bar."
              : "Add a domain to keep its registration, DNS, providers, and notifications close at hand."
          }
          onAction={filterCount > 0 || query ? undefined : () => router.push("/(tabs)/domains/add")}
          title={filterCount > 0 || query ? "No domains match" : "No domains found"}
        />
      </View>
    ) : null;

  return (
    <View className="flex-1">
      <FlashList
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        data={isLoading ? [] : visibleDomains}
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
