import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { router } from "expo-router";
import { memo, useCallback, useState } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { HeaderMenu } from "@/components/header-menu";
import { RefreshControl } from "@/components/refresh-control";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { AppRouter } from "@domainstack/api";

type NotificationItem = inferRouterOutputs<AppRouter>["notifications"]["list"]["items"][number];
type NotificationFilter = "all" | "unread" | "read";

const filters: Array<{ label: string; value: NotificationFilter }> = [
  { label: "Inbox", value: "unread" },
  { label: "Archive", value: "read" },
  { label: "All", value: "all" },
];

export default function NotificationsScreen() {
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
        <MutedText>
          Sign in to review ownership, expiry, provider, and certificate changes.
        </MutedText>
        <EmptyState
          actionLabel="Sign in"
          body="Notifications are tied to tracked portfolio domains and push registration."
          onAction={() => router.push("/sign-in")}
          title="Notifications are locked"
        />
      </Screen>
    );
  }

  return <NotificationsList />;
}

function NotificationsList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("unread");
  const [refreshing, setRefreshing] = useState(false);

  const notifications = useQuery(
    trpc.notifications.list.queryOptions({ cursor: undefined, filter, limit: 50 }),
  );
  const unread = useQuery(trpc.notifications.unreadCount.queryOptions());

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.notifications.unreadCount.queryKey() }),
    ]);
  }, [queryClient, trpc.notifications.list, trpc.notifications.unreadCount]);

  const markRead = useMutation(
    trpc.notifications.markRead.mutationOptions({ onSuccess: invalidate }),
  );
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions({ onSuccess: invalidate }),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invalidate();
    } finally {
      setRefreshing(false);
    }
  }, [invalidate]);

  const handleOpenDomain = useCallback((domainName: string) => {
    router.push({
      params: { domain: domainName },
      pathname: "/(tabs)/domains/[domain]",
    });
  }, []);

  const handleMarkRead = useCallback(
    (id: string) => {
      void markRead.mutateAsync({ id });
    },
    [markRead],
  );

  const markReadPending = markRead.isPending;

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <View className="px-4 pb-3">
        <NotificationRow
          item={item}
          markReadPending={markReadPending}
          onMarkRead={handleMarkRead}
          onOpenDomain={handleOpenDomain}
        />
      </View>
    ),
    [handleMarkRead, handleOpenDomain, markReadPending],
  );

  const items = notifications.data?.items ?? [];
  const unreadCount = unread.data ?? 0;

  const listHeader = (
    <View className="gap-5 px-4 pt-3 pb-2">
      <HeaderMenu />

      <SegmentedControl onChange={setFilter} options={filters} value={filter} />

      {unreadCount > 0 ? (
        <Button
          loading={markAllRead.isPending}
          onPress={() => void markAllRead.mutateAsync()}
          variant="secondary"
        >
          <Text>Mark all read ({unreadCount})</Text>
        </Button>
      ) : null}

      {notifications.isPending ? <SkeletonRows /> : null}

      {notifications.error ? (
        <EmptyState
          actionLabel="Retry"
          body={notifications.error.message}
          onAction={() => void notifications.refetch()}
          title="Notifications did not load"
        />
      ) : null}
    </View>
  );

  const listEmpty =
    !notifications.isPending && !notifications.error && items.length === 0 ? (
      <View className="px-4 pb-8">
        <EmptyState
          body="Notifications you have not read yet will appear here."
          title={filter === "read" ? "No archived notifications" : "No notifications"}
        />
      </View>
    ) : null;

  return (
    <FlashList
      ListEmptyComponent={listEmpty}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={keyExtractor}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
      renderItem={renderItem}
    />
  );
}

function keyExtractor(item: NotificationItem): string {
  return item.id;
}

const NotificationRow = memo(function NotificationRow({
  item,
  markReadPending,
  onMarkRead,
  onOpenDomain,
}: {
  item: NotificationItem;
  markReadPending: boolean;
  onMarkRead: (id: string) => void;
  onOpenDomain: (domainName: string) => void;
}) {
  const domainName = extractDomainNameFromData(item.data);
  const handleOpen = useCallback(() => {
    if (domainName) onOpenDomain(domainName);
  }, [domainName, onOpenDomain]);

  const handleMarkRead = useCallback(() => onMarkRead(item.id), [item.id, onMarkRead]);

  return (
    <GlassCard>
      <View className="gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-lg font-semibold" numberOfLines={2}>
            {item.title}
          </Text>
          {item.readAt ? null : (
            <Badge tone="warning">
              <Text>Unread</Text>
            </Badge>
          )}
        </View>
        <MutedText>{item.message}</MutedText>
        <MutedText>{formatDate(item.sentAt)}</MutedText>
      </View>
      <View className="flex-row gap-2">
        {domainName ? (
          <Button className="flex-1" onPress={handleOpen} variant="secondary">
            <Text>Open {domainName}</Text>
          </Button>
        ) : null}
        {item.readAt ? null : (
          <Button className="flex-1" loading={markReadPending} onPress={handleMarkRead}>
            <Text>Mark read</Text>
          </Button>
        )}
      </View>
    </GlassCard>
  );
});

function extractDomainNameFromData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const candidate = (data as { domainName?: unknown }).domainName;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}
