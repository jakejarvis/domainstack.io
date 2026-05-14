import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Link, router } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useCSSVariable } from "uniwind";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { HeaderMenu } from "@/components/header-menu";
import { NotificationListSkeleton } from "@/components/notifications/notification-card-skeleton";
import { RefreshControl } from "@/components/refresh-control";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { Spinner } from "@/components/spinner";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { AppRouter } from "@domainstack/api";

const SWIPE_ACTION_WIDTH = 96;

const PAGE_SIZE = 20;

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
  const mutedIconColor = useCSSVariable("--color-text-secondary") as string;

  const notifications = useInfiniteQuery(
    trpc.notifications.list.infiniteQueryOptions(
      { filter, limit: PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
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

  const handleMarkRead = useCallback(
    (id: string) => {
      void markRead.mutateAsync({ id });
    },
    [markRead],
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = notifications;
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow item={item} onMarkRead={handleMarkRead} />
    ),
    [handleMarkRead],
  );

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = unread.data ?? 0;
  const isInitialLoading = notifications.isPending && !notifications.error;

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

      {notifications.error ? (
        <EmptyState
          actionLabel="Retry"
          body={notifications.error.message}
          icon={<MaterialIcons color={mutedIconColor} name="error-outline" size={48} />}
          onAction={() => void notifications.refetch()}
          title="Notifications did not load"
        />
      ) : null}
    </View>
  );

  const listEmpty = isInitialLoading ? (
    <View className="gap-3 px-4 pb-8">
      <NotificationListSkeleton />
    </View>
  ) : !notifications.error && items.length === 0 ? (
    <View className="px-4 pb-8">
      <EmptyState
        actionLabel="Browse portfolio"
        body={
          filter === "read"
            ? "Notifications you have marked read will appear here."
            : "You're all caught up. New domain, certificate, and provider changes will show up here."
        }
        icon={
          <MaterialIcons
            color={mutedIconColor}
            name={filter === "read" ? "archive" : "celebration"}
            size={48}
          />
        }
        onAction={() => router.push("/(tabs)/domains")}
        title={filter === "read" ? "No archived notifications" : "All caught up!"}
      />
    </View>
  ) : null;

  const listFooter = isFetchingNextPage ? (
    <View className="items-center py-4">
      <Spinner tone="muted" />
    </View>
  ) : null;

  return (
    <FlashList
      ListEmptyComponent={listEmpty}
      ListFooterComponent={listFooter}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
      data={items}
      keyExtractor={keyExtractor}
      keyboardShouldPersistTaps="handled"
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
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
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  const { domainName, targetSection } = item;
  const swipeableRef = useRef<SwipeableMethods>(null);
  const handleMarkRead = useCallback(() => {
    swipeableRef.current?.close();
    onMarkRead(item.id);
  }, [item.id, onMarkRead]);

  const body = (
    <View
      className="border-line bg-glass gap-2 overflow-hidden rounded-2xl border p-4"
      style={{ borderCurve: "continuous" }}
    >
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
  );

  const renderLeftActions = useCallback(
    () => (
      <View className="flex-row items-stretch pr-2">
        <Pressable
          accessibilityLabel="Mark as read"
          accessibilityRole="button"
          className="bg-brand items-center justify-center rounded-2xl px-4"
          onPress={handleMarkRead}
          style={{ borderCurve: "continuous", width: SWIPE_ACTION_WIDTH }}
        >
          <Text className="text-control-primary-text font-semibold">Mark read</Text>
        </Pressable>
      </View>
    ),
    [handleMarkRead],
  );

  const swipeable = (content: React.ReactNode) =>
    item.readAt ? (
      content
    ) : (
      <ReanimatedSwipeable
        friction={2}
        leftThreshold={64}
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
      >
        {content}
      </ReanimatedSwipeable>
    );

  if (!domainName) {
    return <View className="px-4 pb-3">{swipeable(body)}</View>;
  }

  const params: { domain: string; section?: string } = { domain: domainName };
  if (targetSection) params.section = targetSection;

  return (
    <View className="px-4 pb-3">
      {swipeable(
        <Link asChild href={{ params, pathname: "/(tabs)/domains/[domain]" }}>
          <Link.Trigger>
            <Pressable accessibilityLabel={`Open ${domainName}`} accessibilityRole="link">
              {body}
            </Pressable>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            {item.readAt ? null : (
              <Link.MenuAction icon="checkmark.circle" onPress={handleMarkRead}>
                Mark as read
              </Link.MenuAction>
            )}
          </Link.Menu>
        </Link>,
      )}
    </View>
  );
});
