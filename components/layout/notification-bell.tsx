"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
  EthernetPort,
  FingerprintPattern,
  IdCardLanyard,
  Inbox,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { NotificationType } from "@/lib/constants/notifications";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

// Map notification types to icons
function getNotificationIcon(type: string) {
  const notificationType = type as NotificationType;

  if (notificationType.startsWith("domain_expiry")) {
    return CalendarDays;
  }
  if (notificationType.startsWith("certificate_expiry")) {
    return ShieldAlert;
  }
  if (notificationType === "certificate_change") {
    return FingerprintPattern;
  }
  if (notificationType === "provider_change") {
    return EthernetPort;
  }
  if (notificationType === "registration_change") {
    return IdCardLanyard;
  }
  if (
    notificationType === "verification_failing" ||
    notificationType === "verification_revoked"
  ) {
    return AlertTriangle;
  }

  return Bell;
}

// Map notification types to severity for color coding
function getNotificationSeverity(
  type: string,
): "critical" | "warning" | "info" {
  const notificationType = type as NotificationType;

  // Critical: Expires in 1 day, verification revoked
  if (
    notificationType === "domain_expiry_1d" ||
    notificationType === "certificate_expiry_1d" ||
    notificationType === "verification_revoked"
  ) {
    return "critical";
  }

  // Warning: Expires in 7 days or less, verification failing
  if (
    notificationType === "domain_expiry_7d" ||
    notificationType === "certificate_expiry_3d" ||
    notificationType === "certificate_expiry_7d" ||
    notificationType === "verification_failing"
  ) {
    return "warning";
  }

  // Info: Everything else (changes, 14-30 day warnings)
  return "info";
}

// Get colors based on severity and read status
function getSeverityColors(
  severity: "critical" | "warning" | "info",
  isRead: boolean,
) {
  if (isRead) {
    // Muted colors for read notifications
    return {
      bg: "bg-muted",
      text: "text-muted-foreground",
    };
  }

  // Vibrant colors for unread notifications
  switch (severity) {
    case "critical":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
      };
    case "warning":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-500",
      };
    default:
      return {
        bg: "bg-primary/10",
        text: "text-primary",
      };
  }
}

export function NotificationBell() {
  const trpc = useTRPC();
  const { markRead, markAllRead } = useNotificationMutations();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"inbox" | "archive">("inbox");
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);
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

  // Scroll position tracking for gradient indicators
  const updateScrollIndicators = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollArea;
    setShowTopIndicator(scrollTop > 20);
    setShowBottomIndicator(scrollTop < scrollHeight - clientHeight - 20);
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    // Initial check
    updateScrollIndicators();

    scrollArea.addEventListener("scroll", updateScrollIndicators);

    return () => {
      scrollArea.removeEventListener("scroll", updateScrollIndicators);
    };
  }, [updateScrollIndicators]);

  // Recalculate when content changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to trigger this when the list changes
  useEffect(() => {
    const timeoutId = setTimeout(updateScrollIndicators, 100);
    return () => clearTimeout(timeoutId);
  }, [notifications.length, updateScrollIndicators]);

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
      <PopoverContent className="w-96 overflow-hidden p-0" align="end">
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

          {/* Scrollable content area */}
          <div className="relative flex-1 overflow-hidden bg-card">
            {/* Top scroll indicator */}
            {showTopIndicator && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black/5 to-transparent dark:from-black/25"
              />
            )}

            <div
              ref={scrollAreaRef}
              className="h-full max-h-[480px] overflow-y-auto"
            >
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : isNotificationsError ? (
                <div className="p-12 text-center text-destructive text-sm">
                  Failed to load notifications
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  {view === "inbox" ? (
                    <>
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent/50 dark:bg-accent/30">
                        <Inbox className="size-6 text-foreground/50 dark:text-foreground/70" />
                      </div>
                      <p className="text-foreground/80 text-sm">
                        All caught up!
                      </p>
                      <p className="mt-1 text-[13px] text-muted-foreground/80">
                        No unread notifications
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent/50 dark:bg-accent/30">
                        <Archive className="size-6 text-foreground/50 dark:text-foreground/70" />
                      </div>
                      <p className="text-foreground/80 text-sm">
                        No archived notifications
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const severity = getNotificationSeverity(notification.type);
                    const colors = getSeverityColors(
                      severity,
                      !!notification.readAt,
                    );

                    return (
                      <Link
                        key={notification.id}
                        href="/dashboard"
                        data-notification-id={notification.id}
                        onClick={() => {
                          setOpen(false);
                          if (
                            !notification.readAt &&
                            !markedAsReadIds.has(notification.id)
                          ) {
                            setMarkedAsReadIds((prev) =>
                              new Set(prev).add(notification.id),
                            );
                            markRead.mutate({ id: notification.id });
                          }
                        }}
                        className={cn(
                          "block w-full p-3 transition-colors hover:bg-muted/40",
                          !notification.readAt &&
                            "bg-accent/20 hover:bg-accent/25",
                        )}
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg",
                              colors.bg,
                              colors.text,
                            )}
                          >
                            <Icon className="size-4" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm leading-tight">
                                {notification.title}
                              </p>
                              {!notification.readAt && (
                                <span
                                  className={cn(
                                    "mt-0.5 size-2 shrink-0 rounded-full",
                                    severity === "critical" && "bg-destructive",
                                    severity === "warning" && "bg-amber-500",
                                    severity === "info" && "bg-blue-500",
                                  )}
                                  role="status"
                                  aria-label="Unread"
                                />
                              )}
                            </div>
                            <p className="line-clamp-2 text-[13px] text-muted-foreground leading-relaxed">
                              {notification.message}
                            </p>
                            <p className="text-muted-foreground/75 text-xs">
                              {formatDistanceToNow(notification.sentAt, {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}

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
            </div>

            {/* Bottom scroll indicator */}
            {showBottomIndicator && notifications.length > 0 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-12 items-end justify-center bg-gradient-to-t from-black/5 to-transparent pb-2 dark:from-black/25"
              >
                <ChevronDown className="size-4 animate-bounce text-muted-foreground/50" />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
