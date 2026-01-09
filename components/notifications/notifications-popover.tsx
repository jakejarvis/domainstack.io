import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Archive,
  Bell,
  CheckCheck,
  Inbox,
  Settings,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { useRouter } from "@/hooks/use-router";
import { useTRPC } from "@/lib/trpc/client";
import type { NotificationData } from "@/lib/types";

export function NotificationsPopover() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { markRead, markAllRead } = useNotificationMutations();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [open, setOpen] = useState(false);
  const autoMarkedThisOpenRef = useRef(false);
  const unreadCountQueryKey = trpc.notifications.unreadCount.queryKey();

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

  const getLatestUnreadCount = () => {
    return queryClient.getQueryData<number>(unreadCountQueryKey) ?? count;
  };

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
                  size="sm"
                  className="relative"
                  aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
                >
                  <Bell />
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
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden p-0 max-sm:w-[calc(100vw-1rem)] sm:w-96"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <div className="flex max-h-[calc(min(100dvh-6rem,600px))] flex-col">
          {/* Header with tabs */}
          <div className="shrink-0 space-y-3 border-b p-4">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 py-1 font-medium text-[15px] leading-none">
                <Bell className="size-4" />
                Notifications
              </h4>
              <div className="flex items-center gap-1.5">
                <ButtonGroup>
                  {view === "inbox" && count > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => markAllRead.mutate()}
                      disabled={markAllRead.isPending}
                      aria-label="Clear All"
                    >
                      <CheckCheck className="text-muted-foreground" />
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    aria-label="Notification settings"
                    nativeButton={false}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push("/settings/notifications");
                      setOpen(false);
                    }}
                    render={
                      <Link href="/settings/notifications">
                        <Settings className="text-muted-foreground" />
                        Settings
                      </Link>
                    }
                  />
                </ButtonGroup>

                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-1.5 size-7"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <XIcon className="size-3.5" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </div>

            <Tabs
              value={view}
              onValueChange={(v) => {
                const nextView = v as typeof view;

                // When switching away from Inbox with unread notifications, mark them all as read.
                if (view === "inbox" && nextView === "archive") {
                  maybeAutoMarkAllRead();
                }

                setView(nextView);
              }}
            >
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
