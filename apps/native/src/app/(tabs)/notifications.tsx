import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/segmented-control";
import { SkeletonRows } from "@/components/skeleton";
import { MutedText, Text } from "@/components/text";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";

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
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        <View className="gap-2">
          <Text className="text-4xl font-semibold">Notifications</Text>
          <MutedText>
            Sign in to review ownership, expiry, provider, and certificate changes.
          </MutedText>
        </View>
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

  const notifications = useQuery(
    trpc.notifications.list.queryOptions({ cursor: undefined, filter, limit: 50 }),
  );
  const unread = useQuery(trpc.notifications.unreadCount.queryOptions());

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

  const markRead = useMutation(
    trpc.notifications.markRead.mutationOptions({ onSuccess: invalidate }),
  );
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions({ onSuccess: invalidate }),
  );

  return (
    <Screen>
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <Text className="text-4xl font-semibold">Notifications</Text>
          {(unread.data ?? 0) > 0 && <Badge tone="warning">{unread.data}</Badge>}
        </View>
        <MutedText>Review ownership, expiry, provider, and certificate changes.</MutedText>
      </View>

      <SegmentedControl onChange={setFilter} options={filters} value={filter} />

      {(unread.data ?? 0) > 0 && (
        <Button
          loading={markAllRead.isPending}
          onPress={() => void markAllRead.mutateAsync()}
          variant="secondary"
        >
          <Text>Mark all read</Text>
        </Button>
      )}

      {notifications.isPending && <SkeletonRows />}

      {notifications.error && (
        <EmptyState
          actionLabel="Retry"
          body={notifications.error.message}
          onAction={() => void notifications.refetch()}
          title="Notifications did not load"
        />
      )}

      {!notifications.isPending && notifications.data?.items.length === 0 && (
        <EmptyState
          body="Notifications you have not read yet will appear here."
          title={filter === "read" ? "No archived notifications" : "No notifications"}
        />
      )}

      <View className="gap-3">
        {notifications.data?.items.map((item) => (
          <GlassCard key={item.id}>
            <View className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-lg font-semibold" numberOfLines={2}>
                  {item.title}
                </Text>
                {!item.readAt && (
                  <Badge tone="warning">
                    <Text>Unread</Text>
                  </Badge>
                )}
              </View>
              <MutedText>{item.message}</MutedText>
              <MutedText>{formatDate(item.sentAt)}</MutedText>
            </View>
            <View className="flex-row gap-2">
              {item.trackedDomainId && (
                <Button
                  className="flex-1"
                  onPress={() => router.push(`/(tabs)/domains/${item.trackedDomainId}`)}
                  variant="secondary"
                >
                  <Text>Open domain</Text>
                </Button>
              )}
              {!item.readAt && (
                <Button
                  className="flex-1"
                  loading={markRead.isPending}
                  onPress={() => void markRead.mutateAsync({ id: item.id })}
                >
                  <Text>Mark read</Text>
                </Button>
              )}
            </View>
          </GlassCard>
        ))}
      </View>
    </Screen>
  );
}
