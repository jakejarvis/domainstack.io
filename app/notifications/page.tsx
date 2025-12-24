"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Inbox, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NotificationsListSkeleton } from "@/components/notifications/notifications-skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificationMutations } from "@/hooks/use-notification-mutations";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/routers/_app";

type NotificationList = inferProcedureOutput<
  AppRouter["notifications"]["list"]
>;
type Notification = NotificationList["items"][number];

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const trpc = useTRPC();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { markRead, markAllRead } = useNotificationMutations();

  const { data: unreadCount = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      ...trpc.notifications.list.infiniteQueryOptions({ limit: 20 }),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: true,
    });

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.readAt)
      : notifications;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <Bell className="size-5" />
            Notifications
          </h1>
          <p className="mt-2 text-muted-foreground">
            Stay updated on your tracked domains
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="mr-2 size-4" />
            Mark all read
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-0">
          {isLoading ? (
            <NotificationsListSkeleton />
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center text-center">
                  {filter === "unread" ? (
                    <CheckCheck className="mb-4 size-12 text-muted-foreground" />
                  ) : (
                    <Inbox className="mb-4 size-12 text-muted-foreground" />
                  )}
                  <h3 className="mb-2 font-semibold text-lg">
                    {filter === "unread"
                      ? "All caught up!"
                      : "No notifications yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {filter === "unread"
                      ? "You have no unread notifications"
                      : "You'll see notifications here when we detect changes to your domains"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={cn(
                    "transition-colors hover:bg-muted/50",
                    !notification.readAt && "border-l-4 border-l-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 rounded-full p-2",
                              !notification.readAt
                                ? "bg-primary/10"
                                : "bg-muted",
                            )}
                          >
                            <Bell
                              className={cn(
                                "size-4",
                                !notification.readAt
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">
                                {notification.title}
                              </CardTitle>
                              {!notification.readAt && (
                                <span
                                  className="size-2 rounded-full bg-blue-500"
                                  role="status"
                                  aria-label="Unread"
                                />
                              )}
                            </div>
                            <CardDescription className="text-sm">
                              {notification.message}
                            </CardDescription>
                          </div>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {formatDistanceToNow(notification.sentAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </CardHeader>
                  </button>
                </Card>
              ))}

              {/* Infinite scroll trigger */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {isFetchingNextPage && (
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
