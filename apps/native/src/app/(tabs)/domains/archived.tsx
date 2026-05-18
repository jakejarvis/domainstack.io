import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ArchivedRow, type ArchivedRowDomain } from "@/components/portfolio/archived-row";
import { RefreshControl } from "@/components/refresh-control";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { confirmDestructive } from "@/lib/native-confirm";

const LIST_INPUT = { includeArchived: true } as const;

export default function ArchivedDomainsScreen() {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Sign in"
          body="Sign in to view your archived portfolio."
          icon={{ android: "lock", ios: "lock" }}
          onAction={() => router.push("/sign-in")}
          title="Sign in required"
        />
      </Screen>
    );
  }

  return <ArchivedScreen />;
}

function ArchivedScreen() {
  const trpc = useTRPC();
  const dashboard = useDashboardMutations();
  const [refreshing, setRefreshing] = useState(false);

  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());

  const archivedDomains = useMemo<ArchivedRowDomain[]>(() => {
    return (domainsQuery.data ?? []).flatMap((domain) =>
      domain.archivedAt != null
        ? [{ archivedAt: domain.archivedAt, domainName: domain.domainName, id: domain.id }]
        : [],
    );
  }, [domainsQuery.data]);

  const canReactivate = subscriptionQuery.data?.canAddMore ?? true;

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

  const listHeader = (
    <View className="gap-4 px-4 pt-3 pb-2">
      <Text className="text-sm text-muted-foreground">
        Archived domains don't count toward your plan limit. Reactivate to resume tracking.
      </Text>
      {domainsQuery.isPending ? <SkeletonRows /> : null}
      {domainsQuery.error ? (
        <EmptyState
          actionLabel="Retry"
          body={domainsQuery.error.message}
          icon={{ android: "error_outline", ios: "exclamationmark.circle" }}
          onAction={() => void domainsQuery.refetch()}
          title="Archived domains did not load"
        />
      ) : null}
    </View>
  );

  const listEmpty =
    !domainsQuery.isPending && !domainsQuery.error ? (
      <View className="px-4 pb-8">
        <EmptyState
          body="Archive domains from the detail screen to keep them here for later."
          icon={{ android: "archive", ios: "archivebox" }}
          title="No archived domains"
        />
      </View>
    ) : null;

  return (
    <FlashList
      ListEmptyComponent={listEmpty}
      ListHeaderComponent={listHeader}
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
