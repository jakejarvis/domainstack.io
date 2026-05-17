import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Link, router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useMemo, useRef, useState } from "react";
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
import { Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
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
        <Text className="text-sm text-muted-foreground">
          Sign in to review ownership, expiry, provider, and certificate changes.
        </Text>
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
  const mutedIconColor = useCSSVariable("--color-muted-foreground") as string;

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

  const listKeys = useMemo(
    () => ({
      all: trpc.notifications.list.infiniteQueryOptions(
        { filter: "all", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
      read: trpc.notifications.list.infiniteQueryOptions(
        { filter: "read", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
      unread: trpc.notifications.list.infiniteQueryOptions(
        { filter: "unread", limit: PAGE_SIZE },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ).queryKey,
    }),
    [trpc.notifications.list],
  );
  const countKey = trpc.notifications.unreadCount.queryKey();

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: countKey }),
    ]);
  }, [queryClient, trpc.notifications.list, countKey]);

  type InfinitePages = NonNullable<typeof notifications.data>;

  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }: { id: string }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.unread }),
        queryClient.cancelQueries({ queryKey: listKeys.read }),
        queryClient.cancelQueries({ queryKey: listKeys.all }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);

      const previousUnread = queryClient.getQueryData<InfinitePages>(listKeys.unread);
      const previousRead = queryClient.getQueryData<InfinitePages>(listKeys.read);
      const previousAll = queryClient.getQueryData<InfinitePages>(listKeys.all);
      const previousCount = queryClient.getQueryData<number>(countKey);

      const wasInUnread = previousUnread?.pages.some((page) => page.items.some((n) => n.id === id));

      if (wasInUnread) {
        queryClient.setQueryData<number | undefined>(countKey, (old) =>
          typeof old === "number" ? Math.max(0, old - 1) : old,
        );
      }

      queryClient.setQueryData<InfinitePages | undefined>(listKeys.unread, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((n) => n.id !== id),
          })),
        };
      });

      const now = new Date();
      const flipReadAt = (old: InfinitePages | undefined): InfinitePages | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
          })),
        };
      };
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.read, flipReadAt);
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.all, flipReadAt);

      return { previousUnread, previousRead, previousAll, previousCount };
    },
    onError: (err, _vars, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(listKeys.unread, context.previousUnread);
      }
      if (context?.previousRead !== undefined) {
        queryClient.setQueryData(listKeys.read, context.previousRead);
      }
      if (context?.previousAll !== undefined) {
        queryClient.setQueryData(listKeys.all, context.previousAll);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countKey, context.previousCount);
      }
      toast.error({ title: "Failed to mark read", message: err.message });
    },
    onSettled: () => void invalidate(),
  });

  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKeys.unread }),
        queryClient.cancelQueries({ queryKey: listKeys.read }),
        queryClient.cancelQueries({ queryKey: listKeys.all }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);

      const previousUnread = queryClient.getQueryData<InfinitePages>(listKeys.unread);
      const previousRead = queryClient.getQueryData<InfinitePages>(listKeys.read);
      const previousAll = queryClient.getQueryData<InfinitePages>(listKeys.all);
      const previousCount = queryClient.getQueryData<number>(countKey);

      queryClient.setQueryData<number>(countKey, 0);

      queryClient.setQueryData<InfinitePages | undefined>(listKeys.unread, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({ ...page, items: [], nextCursor: undefined })),
        };
      });

      const now = new Date();
      const markEveryRead = (old: InfinitePages | undefined): InfinitePages | undefined => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
          })),
        };
      };
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.read, markEveryRead);
      queryClient.setQueryData<InfinitePages | undefined>(listKeys.all, markEveryRead);

      return { previousUnread, previousRead, previousAll, previousCount };
    },
    onError: (err, _vars, context) => {
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(listKeys.unread, context.previousUnread);
      }
      if (context?.previousRead !== undefined) {
        queryClient.setQueryData(listKeys.read, context.previousRead);
      }
      if (context?.previousAll !== undefined) {
        queryClient.setQueryData(listKeys.all, context.previousAll);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countKey, context.previousCount);
      }
      toast.error({ title: "Failed to mark all read", message: err.message });
    },
    onSettled: () => void invalidate(),
  });

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
          icon={
            <SymbolView
              name={{ ios: "exclamationmark.circle", android: "error_outline" }}
              size={48}
              tintColor={mutedIconColor}
            />
          }
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
          <SymbolView
            name={
              filter === "read"
                ? { ios: "archivebox", android: "archive" }
                : { ios: "party.popper", android: "celebration" }
            }
            size={48}
            tintColor={mutedIconColor}
          />
        }
        onAction={() => router.push("/(tabs)/domains")}
        title={filter === "read" ? "No archived notifications" : "All caught up!"}
      />
    </View>
  ) : null;

  const listFooter = isFetchingNextPage ? (
    <View className="items-center py-4">
      <Spinner variant="muted" />
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
