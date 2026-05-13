import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { ArchivedRow, type ArchivedRowDomain } from "@/components/portfolio/archived-row";
import { RefreshControl } from "@/components/refresh-control";
import { Screen } from "@/components/screen";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";

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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions(LIST_INPUT));
  const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());

  type ListItem = NonNullable<typeof domainsQuery.data>[number];

  const archivedDomains = useMemo<ArchivedRowDomain[]>(() => {
    return (domainsQuery.data ?? [])
      .filter((domain) => domain.archivedAt != null)
      .map((domain) => ({
        archivedAt: domain.archivedAt,
        domainName: domain.domainName,
        id: domain.id,
      }));
  }, [domainsQuery.data]);

  const listKey = trpc.tracking.listDomains.queryKey(LIST_INPUT);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.tracking.listDomains.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.user.getSubscription.queryKey() }),
    ]);
  };

  const unarchive = useMutation({
    mutationFn: trpc.tracking.unarchiveDomain.mutationOptions().mutationFn,
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
      Alert.alert("Reactivation failed", error.message);
    },
    onMutate: async (variables: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ListItem[]>(listKey);
      queryClient.setQueryData<ListItem[]>(listKey, (old) =>
        old?.map((item) =>
          item.id === variables.trackedDomainId ? { ...item, archivedAt: null } : item,
        ),
      );
      return { previous };
    },
    onSettled: () => {
      void invalidateAll();
    },
  });

  const remove = useMutation({
    mutationFn: trpc.tracking.removeDomain.mutationOptions().mutationFn,
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKey, context.previous);
      }
      Alert.alert("Removal failed", error.message);
    },
    onMutate: async (variables: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<ListItem[]>(listKey);
      queryClient.setQueryData<ListItem[]>(listKey, (old) =>
        old?.filter((item) => item.id !== variables.trackedDomainId),
      );
      return { previous };
    },
    onSettled: () => {
      void invalidateAll();
    },
  });

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
      unarchive.mutate({ trackedDomainId: domain.id });
    },
    [unarchive],
  );

  const handleRemove = useCallback(
    (domain: ArchivedRowDomain) => {
      Alert.alert(
        `Remove ${domain.domainName}?`,
        "This permanently removes the domain and any notification settings.",
        [
          { style: "cancel", text: "Cancel" },
          {
            onPress: () => remove.mutate({ trackedDomainId: domain.id }),
            style: "destructive",
            text: "Remove",
          },
        ],
      );
    },
    [remove],
  );

  const handleRowPress = useCallback((domain: ArchivedRowDomain) => {
    router.push({
      params: { domain: domain.domainName },
      pathname: "/(tabs)/domains/[domain]",
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ArchivedRowDomain }) => (
      <View className="px-4 pb-3">
        <ArchivedRow
          canReactivate={canReactivate}
          domain={item}
          onPress={handleRowPress}
          onReactivate={handleReactivate}
          onRemove={handleRemove}
        />
      </View>
    ),
    [canReactivate, handleReactivate, handleRemove, handleRowPress],
  );

  const listHeader = (
    <View className="gap-4 px-4 pt-3 pb-2">
      <MutedText>
        Archived domains don't count toward your plan limit. Reactivate to resume tracking.
      </MutedText>
      {domainsQuery.isPending ? <SkeletonRows /> : null}
      {domainsQuery.error ? (
        <EmptyState
          actionLabel="Retry"
          body={domainsQuery.error.message}
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
