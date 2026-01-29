import type { NotificationData } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@domainstack/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@domainstack/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import { cn } from "@domainstack/ui/utils";
import {
  IconArchive,
  IconBell,
  IconBellCog,
  IconChecks,
  IconInbox,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { useNotificationsData } from "@/hooks/use-notifications-data";
import { useRouter } from "@/hooks/use-router";

export function NotificationsPopover() {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const autoMarkedThisOpenRef = useRef(false);

  // Map view to filter parameter
  const filter = view === "inbox" ? "unread" : "read";

  // Data fetching and mutations
  const {
    notifications,
    count,
    showLoading,
    hasNextPage,
    isFetchingNextPage,
    isError: isNotificationsError,
    markRead,
    markAllRead,
    fetchNextPage,
    getLatestUnreadCount,
  } = useNotificationsData({ filter, enabled: open });

  // Avoid duplicate auto-mark calls within a single open session.
  useEffect(() => {
    if (open) {
      autoMarkedThisOpenRef.current = false;
    }
  }, [open]);

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
