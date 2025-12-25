"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { inferProcedureOutput } from "@trpc/server";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotificationMutations } from "@/hooks/use-notification-mutations";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/routers/_app";

type NotificationList = inferProcedureOutput<
  AppRouter["notifications"]["list"]
>;
type Notification = NotificationList["items"][number];

export function NotificationBell() {
  const trpc = useTRPC();
  const { markRead, markAllRead } = useNotificationMutations();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Get unread count
  const { data: count = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  // Get notifications with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError: isNotificationsError,
  } = useInfiniteQuery({
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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative cursor-pointer"
                  aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
                />
              }
            >
              <Bell />
              {count > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                  aria-hidden="true"
                />
              )}
            </PopoverTrigger>
          }
        />
        <TooltipContent>
          {count > 0 ? `Notifications (${count})` : "Notifications"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex max-h-[600px] flex-col">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 text-xs"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="mr-1 size-3" />
                Clear all
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isNotificationsError ? (
              <div className="p-8 text-center text-destructive text-sm">
                Failed to load notifications
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full p-4 text-left text-sm transition-colors hover:bg-muted/50",
                      !notification.readAt && "bg-muted/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium leading-none">
                            {notification.title}
                          </span>
                          {!notification.readAt && (
                            <span
                              className="size-1.5 rounded-full bg-blue-500"
                              role="status"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        <p className="line-clamp-2 text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDistanceToNow(notification.sentAt, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {/* Infinite scroll trigger */}
                {hasNextPage && (
                  <div ref={loadMoreRef} className="flex justify-center py-4">
                    {isFetchingNextPage && (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
