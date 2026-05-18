import { FlashList } from "@shopify/flash-list";
import { useIsRestoring, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ArchivedRow, type ArchivedRowDomain } from "@/components/portfolio/archived-row";
import { QueryErrorState } from "@/components/query-error-state";
import { RefreshControl } from "@/components/refresh-control";
import { RequireAuth } from "@/components/require-auth";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useTRPC } from "@/lib/api";
import { confirmDestructive } from "@/lib/native-confirm";

const LIST_INPUT = { includeArchived: true } as const;

// Fully static — hoisted so FlashList's header/empty aren't rebuilt each render.
const ARCHIVED_LIST_HEADER = (
  <View className="gap-4 px-4 pt-3 pb-2">
    <Text className="text-sm text-muted-foreground">
      Archived domains don’t count toward your plan limit. Reactivate to resume tracking.
    </Text>
  </View>
);

const ARCHIVED_LIST_EMPTY = (
  <View className="px-4 pb-8">
    <EmptyState
      body="Archive domains from the detail screen to keep them here for later."
      icon={{ android: "archive", ios: "archivebox" }}
      title="No archived domains"
    />
  </View>
);

export default function ArchivedDomainsScreen() {
  return (
    <RequireAuth
      body="Sign in to view your archived domains."
      loading={<SkeletonRows count={6} />}
      title="Archived is locked"
    >
      <ArchivedScreen />
    </RequireAuth>
  );
}

function ArchivedScreen() {
  const trpc = useTRPC();
  const dashboard = useDashboardMutations();
  const [refreshing, setRefreshing] = useState(false);

  const isRestoring = useIsRestoring();
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());

  const archivedDomains = useMemo<ArchivedRowDomain[]>(() => {
    return (domainsQuery.data ?? []).flatMap((domain) =>
      domain.archivedAt != null
        ? [{ archivedAt: domain.archivedAt, domainName: domain.domainName, id: domain.id }]
        : [],
    );
  }, [domainsQuery.data]);

  // Default closed until the subscription is known — better to briefly disable
  // Reactivate than to let a user at their plan limit tap it and get a server
  // rejection.
  const canReactivate = subscriptionQuery.data?.canAddMore ?? false;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([domainsQuery.refetch(), subscriptionQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [domainsQuery, subscriptionQuery]);

  const handleReactivate = useCallback(
    (domain: ArchivedRowDomain) => {
      void dashboard.unarchive(domain.id);
    },
    [dashboard],
  );

  const handleRemove = useCallback(
    (domain: ArchivedRowDomain) => {
      void confirmDestructive({
        confirmLabel: "Remove",
        message: "This permanently removes the domain and any notification settings.",
        title: `Remove ${domain.domainName}?`,
      }).then((confirmed) => {
        if (confirmed) void dashboard.remove(domain.id);
      });
    },
    [dashboard],
  );

  const renderItem = useCallback(
    ({ item }: { item: ArchivedRowDomain }) => (
      <View className="px-4 pb-3">
        <ArchivedRow
          canReactivate={canReactivate}
          domain={item}
          onReactivate={handleReactivate}
          onRemove={handleRemove}
        />
      </View>
    ),
    [canReactivate, handleReactivate, handleRemove],
  );

  if (isRestoring || domainsQuery.isPending) {
    return (
      <Screen>
        <SkeletonRows count={6} />
      </Screen>
    );
  }

  if (domainsQuery.error) {
    return (
      <Screen>
        <QueryErrorState
          onRetry={() => void domainsQuery.refetch()}
          title="Couldn’t load archived domains"
        />
      </Screen>
    );
  }

  return (
    <FlashList
      ListEmptyComponent={ARCHIVED_LIST_EMPTY}
      ListHeaderComponent={ARCHIVED_LIST_HEADER}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      data={archivedDomains}
      keyExtractor={keyExtractor}
      refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
      renderItem={renderItem}
    />
  );
}

function keyExtractor(item: ArchivedRowDomain): string {
  return item.id;
}
