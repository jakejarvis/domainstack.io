import {
  IconArchive,
  IconBell,
  IconBellCog,
  IconChecks,
  IconInbox,
} from "@tabler/icons-react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { NotificationList } from "@/components/notifications/notification-list";
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
import { useRouter } from "@/hooks/use-router";
import { useTRPC } from "@/lib/trpc/client";
import type { NotificationData } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

export function NotificationsPopover() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const autoMarkedThisOpenRef = useRef(false);

  // Query keys for cache manipulation
  const pageSize = 20;
  const inboxListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: pageSize,
    filter: "unread",
  }).queryKey;
  const archiveListQueryKey = trpc.notifications.list.infiniteQueryOptions({
    limit: pageSize,
    filter: "read",
  }).queryKey;
  const countQueryKey = trpc.notifications.unreadCount.queryKey();

  // Mark single notification as read
  const markRead = useMutation({
    mutationFn: trpc.notifications.markRead.mutationOptions().mutationFn,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      const previousCount = queryClient.getQueryData(countQueryKey);
      const previousInbox = queryClient.getQueryData(inboxListQueryKey);
      const previousArchive = queryClient.getQueryData(archiveListQueryKey);

      const wasInInbox = previousInbox?.pages?.some((page) =>
        page.items.some((n) => n.id === id),
      );

      if (wasInInbox) {
        queryClient.setQueryData(countQueryKey, (old: number | undefined) =>
          typeof old === "number" ? Math.max(0, old - 1) : old,
        );
      }

      queryClient.setQueryData(inboxListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((n) => n.id !== id),
          })),
        };
      });

      queryClient.setQueryData(archiveListQueryKey, (old) => {
        if (!old?.pages) return old;
        const now = new Date();
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) =>
              n.id === id ? { ...n, readAt: n.readAt ?? now } : n,
            ),
          })),
        };
      });

      return { previousCount, previousInbox, previousArchive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countQueryKey, context.previousCount);
      }
      if (context?.previousInbox) {
        queryClient.setQueryData(inboxListQueryKey, context.previousInbox);
      }
      if (context?.previousArchive) {
        queryClient.setQueryData(archiveListQueryKey, context.previousArchive);
      }
      toast.error("Failed to mark notification as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  // Mark all notifications as read
  const markAllRead = useMutation({
    mutationFn: trpc.notifications.markAllRead.mutationOptions().mutationFn,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: inboxListQueryKey });
      await queryClient.cancelQueries({ queryKey: archiveListQueryKey });
      await queryClient.cancelQueries({ queryKey: countQueryKey });

      const previousCount = queryClient.getQueryData(countQueryKey);
      const previousInbox = queryClient.getQueryData(inboxListQueryKey);
      const previousArchive = queryClient.getQueryData(archiveListQueryKey);

      queryClient.setQueryData(countQueryKey, 0);

      queryClient.setQueryData(inboxListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            nextCursor: undefined,
            items: [],
          })),
        };
      });

      const now = new Date();
      queryClient.setQueryData(archiveListQueryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
          })),
        };
      });

      return { previousCount, previousInbox, previousArchive };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(countQueryKey, context.previousCount);
      }
      if (context?.previousInbox) {
        queryClient.setQueryData(inboxListQueryKey, context.previousInbox);
      }
      if (context?.previousArchive) {
        queryClient.setQueryData(archiveListQueryKey, context.previousArchive);
      }
      toast.error("Failed to mark notifications as read");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: inboxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: archiveListQueryKey });
      void queryClient.invalidateQueries({ queryKey: countQueryKey });
    },
  });

  // Get unread count for inbox
  const { data: count = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  // Map view to filter parameter
  const filter = view === "inbox" ? "unread" : "read";

  // Get notifications with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError: isNotificationsError,
  } = useInfiniteQuery({
    ...trpc.notifications.list.infiniteQueryOptions({
      limit: 20,
      filter,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    // Always refetch on mount/access to ensure fresh data
    staleTime: 0,
    // Base UI popover keeps content mounted for close animations; gate fetching on open
    enabled: open,
  });

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  // Show loading skeleton when initially loading OR when fetching a tab that
  // has never been viewed (no cached data). Once a tab has cached data (even
  // if empty), show that cached state while refetching in the background.
  const showLoading = isLoading || (isFetching && data === undefined);

  // Avoid duplicate auto-mark calls within a single open session.
  useEffect(() => {
    if (open) {
      autoMarkedThisOpenRef.current = false;
    }
  }, [open]);

  const getLatestUnreadCount = () =>
    queryClient.getQueryData<number>(countQueryKey) ?? count;

  const maybeAutoMarkAllRead = () => {
    if (autoMarkedThisOpenRef.current) return;
    if (markAllRead.isPending) return;
    if (view !== "inbox") return;

    const latestUnreadCount = getLatestUnreadCount();
    if (latestUnreadCount <= 0) return;

    autoMarkedThisOpenRef.current = true;
    markAllRead.mutate(undefined, {
      onError: () => {
        // Allow retry within this open session if the mutation fails.
        autoMarkedThisOpenRef.current = false;
      },
    });
  };

  // Note: Refetch on popover open is handled automatically by TanStack Query
  // since staleTime: 0 ensures fresh data on each mount/query key change.
  // The infinite query refetches when `filter` changes (via query key).

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

    if (!open || !loadMoreElement || !hasNextPage || isFetchingNextPage) return;

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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, open]);

  const handleNotificationClick = (notification: NotificationData) => {
    setOpen(false);
    // Only mark as read if not already read
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        // When closing from Inbox with unread notifications, mark them all as read.
        if (!nextOpen) {
          maybeAutoMarkAllRead();
        }
        setOpen(nextOpen);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative"
                  aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
                >
                  <IconBell />
                  {count > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background"
                      aria-hidden
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
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden bg-background p-0 max-sm:w-[calc(100vw-1rem)] sm:w-[400px]"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <div className="flex max-h-[calc(min(100dvh-6rem,560px))] flex-col">
          {/* Header */}
          <div className="shrink-0 border-border border-b bg-card/60">
            {/* Title row */}
            <div className="flex items-center justify-between pt-2 pr-4 pb-1 pl-4">
              <h4 className="font-semibold text-[15px]">Notifications</h4>

              {/* Header actions */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Notification settings"
                      nativeButton={false}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push("/settings/notifications");
                        setOpen(false);
                      }}
                      render={
                        <Link href="/settings/notifications">
                          <IconBellCog className="size-3.5 shrink-0 text-foreground/90" />
                          <span className="sr-only">Settings</span>
                        </Link>
                      }
                    />
                  }
                />
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>
            </div>

            {/* Tabs */}
            <div className="pl-1.5">
              <Tabs
                value={view}
                onValueChange={(v) => {
                  const nextView = v as typeof view;

                  // When switching away from Inbox with unread notifications, mark them all as read.
                  if (view === "inbox" && nextView === "archive") {
                    maybeAutoMarkAllRead();
                  }

                  startTransition(() => setView(nextView));
                }}
              >
                <TabsList variant="line">
                  <TabsTrigger
                    value="inbox"
                    className="flex-initial gap-2 text-[13px] transition-colors hover:text-foreground"
                  >
                    <IconInbox className="!text-inherit" aria-hidden />
                    Inbox
                    {count > 0 && (
                      <span className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1.5 font-medium text-[10px] text-background tabular-nums">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="archive"
                    className="flex-initial gap-2 text-[13px] transition-colors hover:text-foreground"
                  >
                    <IconArchive className="!text-inherit" aria-hidden />
                    Archive
                  </TabsTrigger>

                  {/* Clear all action - aligned to the right */}
                  {view === "inbox" && count > 0 && (
                    <div className="ml-auto flex items-center">
                      <button
                        type="button"
                        onClick={() => markAllRead.mutate()}
                        disabled={markAllRead.isPending}
                        className={cn(
                          "flex h-full items-center gap-1.5 px-2 font-medium text-[13px] text-muted-foreground transition-colors",
                          "hover:text-foreground focus-visible:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        aria-label="Clear all notifications"
                      >
                        <IconChecks className="size-4" aria-hidden />
                        <span className="max-sm:sr-only">Clear&nbsp;all</span>
                      </button>
                    </div>
                  )}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Notification list */}
          <NotificationList
            notifications={notifications}
            isLoading={showLoading}
            isError={isNotificationsError}
            view={view}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadMoreRef={loadMoreRef}
            scrollAreaRef={scrollAreaRef}
            onNotificationClick={handleNotificationClick}
            onClosePopover={() => setOpen(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
