"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Archive, Bell, CheckCheck, Inbox, XIcon } from "lucide-react";
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

export function NotificationsPopover() {
  const trpc = useTRPC();
  const { markRead, markAllRead } = useNotificationMutations();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [open, setOpen] = useState(false);

  // Get unread count for inbox
  const { data: count = 0, refetch: refetchCount } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  // Map view to filter parameter
  const filter = view === "inbox" ? "unread" : "read";

  // Get notifications with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError: isNotificationsError,
    refetch: refetchNotifications,
  } = useInfiniteQuery({
    ...trpc.notifications.list.infiniteQueryOptions({
      limit: 20,
      filter,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    // Always refetch on mount/access to ensure fresh data
    staleTime: 0,
  });

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  // Refetch when popover opens
  useEffect(() => {
    if (open) {
      void refetchNotifications();
      void refetchCount();
    }
  }, [open, refetchNotifications, refetchCount]);

  // Reset scroll position when switching tabs
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger on view change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, [view]);

  // Infinite scroll observer - uses scrollAreaRef as root to observe within the scroll container
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    const loadMoreElement = loadMoreRef.current;

    if (!loadMoreElement || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void fetchNextPage();
        }
      },
      {
        threshold: 0.1,
        // Use the scroll container as the root for proper intersection detection
        root: scrollContainer,
      },
    );

    observer.observe(loadMoreElement);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleNotificationClick = (notification: NotificationData) => {
    setOpen(false);
    // Only mark as read if not already read
    if (!notification.readAt) {
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
                  className="relative"
                  aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
                >
                  <Bell />
                  {count > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              }
            />
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
              <div className="flex items-center gap-1.5">
                {view === "inbox" && count > 0 && (
                  <Button
                    variant="ghost"
                    className="!p-2.5 h-6 w-fit gap-1.5 text-[13px]"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    aria-label="Clear All"
                  >
                    <CheckCheck className="size-3.5" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="!p-2.5 size-6"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="inbox" className="gap-2 text-[13px]">
                  <Inbox />
                  Inbox
                  {count > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 font-medium text-[10px] text-primary-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="archive" className="gap-2 text-[13px]">
                  <Archive />
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
