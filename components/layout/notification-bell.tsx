"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Archive, Bell, Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NotificationData } from "@/components/notifications";
import { NotificationList } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotificationMutations } from "@/hooks/use-notification-mutations";
import { useTRPC } from "@/lib/trpc/client";

export function NotificationBell() {
  const trpc = useTRPC();
  const { markRead, markAllRead } = useNotificationMutations();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [markedAsReadIds, setMarkedAsReadIds] = useState<Set<string>>(
    new Set(),
  );
  const [open, setOpen] = useState(false);

  // Get unread count for inbox
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
    ...trpc.notifications.list.infiniteQueryOptions({
      limit: 20,
      unreadOnly: view === "inbox",
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
  });

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  // Auto-mark notifications as read when they become visible
  useEffect(() => {
    // Only auto-mark on inbox tab
    if (view !== "inbox") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const notificationId = entry.target.getAttribute(
              "data-notification-id",
            );
            if (notificationId && !markedAsReadIds.has(notificationId)) {
              const notification = notifications.find(
                (n) => n.id === notificationId,
              );
              if (notification && !notification.readAt) {
                // Mark locally to prevent duplicate requests
                setMarkedAsReadIds((prev) => new Set(prev).add(notificationId));
                // Mark as read on server
                markRead.mutate({ id: notificationId });
              }
            }
          }
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of notification is visible
        root: scrollAreaRef.current,
      },
    );

    // Observe all notification elements
    const notificationElements = document.querySelectorAll(
      "[data-notification-id]",
    );
    for (const element of notificationElements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [notifications, view, markedAsReadIds, markRead]);

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

  const handleNotificationClick = (notification: NotificationData) => {
    setOpen(false);
    if (!notification.readAt && !markedAsReadIds.has(notification.id)) {
      setMarkedAsReadIds((prev) => new Set(prev).add(notification.id));
      markRead.mutate({ id: notification.id });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
      <PopoverContent
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden p-0 max-sm:w-[calc(100vw-1rem)] sm:w-96"
        align="end"
        collisionPadding={8}
      >
        <div className="flex max-h-[600px] flex-col">
          {/* Header with tabs */}
          <div className="shrink-0 space-y-3 border-b p-4">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 py-1 font-medium text-[15px] leading-none">
                <Bell className="size-4" />
                Notifications
              </h4>
              {view === "inbox" && count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto cursor-pointer py-1 text-[13px]"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <Archive className="mr-1 size-3" />
                  Archive All
                </Button>
              )}
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="inbox" className="text-[13px]">
                  <Inbox className="mr-1.5 size-3.5" />
                  Inbox
                  {count > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 font-medium text-[10px] text-primary-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="archive" className="text-[13px]">
                  <Archive className="mr-1.5 size-3.5" />
                  Archive
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Notification list */}
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            isError={isNotificationsError}
            view={view}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadMoreRef={loadMoreRef}
            scrollAreaRef={scrollAreaRef}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
