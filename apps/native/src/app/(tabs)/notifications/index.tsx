import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Link, router, useFocusEffect } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { HeaderMenu } from "@/components/header-menu";
import { NotificationListSkeleton } from "@/components/notifications/notification-card-skeleton";
import { QueryErrorState } from "@/components/query-error-state";
import { RefreshControl } from "@/components/refresh-control";
import { RequireAuth } from "@/components/require-auth";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { useNotificationMutations } from "@/hooks/use-notification-mutations";
import { useTRPC } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { RouterOutputs } from "@domainstack/api";

const SWIPE_ACTION_WIDTH = 96;

const PAGE_SIZE = 20;

type NotificationItem = RouterOutputs["notifications"]["list"]["items"][number];
type NotificationFilter = "all" | "unread" | "read";

const filters: Array<{ label: string; value: NotificationFilter }> = [
  { label: "Inbox", value: "unread" },
  { label: "Archive", value: "read" },
  { label: "All", value: "all" },
];

export default function NotificationsScreen() {
  return (
    <RequireAuth
      body="Get notified of ownership, expiry, provider, and certificate changes. Notifications are tied to your tracked portfolio domains."
      header={<HeaderMenu />}
      loading={<SkeletonRows count={4} />}
      title="Notifications are locked"
    >
      <NotificationsList />
    </RequireAuth>
  );
}

function NotificationsList() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState<NotificationFilter>("unread");
  const [refreshing, setRefreshing] = useState(false);

  const notifications = useInfiniteQuery(
    trpc.notifications.list.infiniteQueryOptions(
      { filter, limit: PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
  const unread = useQuery(trpc.notifications.unreadCount.queryOptions());

  useFocusEffect(
    useCallback(() => {
      void Notifications.setBadgeCountAsync(0);
      void Notifications.dismissAllNotificationsAsync();
    }, []),
  );

  const { invalidate, markAllRead, markRead } = useNotificationMutations();

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

  // Loading/error replace the chrome — never render an interactive filter
  // control over an empty, skeleton-only list.
  if (notifications.isPending) {
    return (
      <Screen>
        <HeaderMenu />
        <View className="gap-3 px-4 pt-3">
          <NotificationListSkeleton />
        </View>
      </Screen>
    );
  }

  if (notifications.isError && items.length === 0) {
    return (
      <Screen>
        <HeaderMenu />
        <QueryErrorState
          onRetry={() => void notifications.refetch()}
          title="Couldn’t load notifications"
        />
      </Screen>
    );
  }

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
          <Text className="tabular-nums">Mark all read ({unreadCount})</Text>
        </Button>
      ) : null}
    </View>
  );

  const listEmpty = (
    <View className="px-4 pb-8">
      <EmptyState
        actionLabel="Browse portfolio"
        body={
          filter === "read"
            ? "Notifications you have marked read will appear here."
            : "You’re all caught up. New domain, certificate, and provider changes will show up here."
        }
        icon={
          filter === "read"
            ? { android: "archive", ios: "archivebox" }
            : { android: "celebration", ios: "party.popper" }
        }
        onAction={() => router.push("/(tabs)/domains")}
        title={filter === "read" ? "No archived notifications" : "All caught up!"}
      />
    </View>
  );

  // Footer covers the page 2+ failure case: a failed `fetchNextPage` keeps the
  // existing items, so without this the list silently stops paginating.
  const listFooter = isFetchingNextPage ? (
    <View className="items-center py-4">
      <Spinner variant="muted" />
    </View>
  ) : notifications.isError && items.length > 0 ? (
    <View className="items-center gap-2 p-4">
      <Text className="text-center text-sm text-muted-foreground">
        Couldn’t load more notifications.
      </Text>
      <Button onPress={() => void fetchNextPage()} variant="secondary">
        <Text>Try again</Text>
      </Button>
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
    if (process.env.EXPO_OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    swipeableRef.current?.close();
    onMarkRead(item.id);
  }, [item.id, onMarkRead]);

  const body = (
    <View
      className="bg-glass gap-2 overflow-hidden rounded-2xl border border-border p-4"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-lg font-semibold" numberOfLines={2}>
          {item.title}
        </Text>
        {item.readAt ? null : (
          <Badge variant="warning">
            <Text>Unread</Text>
          </Badge>
        )}
      </View>
      <Text className="text-sm text-muted-foreground">{item.message}</Text>
      <Text className="text-sm text-muted-foreground">{formatDate(item.sentAt)}</Text>
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
          <Text className="font-semibold text-primary-foreground">Mark read</Text>
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
