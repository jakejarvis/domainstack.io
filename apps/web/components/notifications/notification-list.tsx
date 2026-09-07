"use client";

import { IconXboxX } from "@tabler/icons-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { RefObject } from "react";

import { NotificationCard } from "@/components/notifications/notification-card";
import { NotificationEmptyState } from "@/components/notifications/notification-empty-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-list-skeleton";
import type { NotificationData } from "@domainstack/types";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { Spinner } from "@domainstack/ui/spinner";

interface NotificationListProps {
  notifications: NotificationData[];
  isLoading: boolean;
  isError: boolean;
  view: "inbox" | "archive";
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  scrollAreaRef?: RefObject<HTMLDivElement | null>;
  onNotificationClick?: (notification: NotificationData) => void;
  onClosePopover?: () => void;
}

export function NotificationList({
  notifications,
  isLoading,
  isError,
  view,
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  scrollAreaRef,
  onNotificationClick,
  onClosePopover,
}: NotificationListProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <ScrollArea scrollRef={scrollAreaRef} className="min-h-0 flex-1 bg-popover/10">
      <div className={!isLoading && !isError && notifications.length > 0 ? "divide-y" : undefined}>
        {isLoading ? (
          <NotificationListSkeleton />
        ) : isError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-1.5 py-12 text-sm"
          >
            <IconXboxX className="size-4" />
            Failed to load notifications
          </div>
        ) : notifications.length === 0 ? (
          <NotificationEmptyState variant={view} onClosePopover={onClosePopover} />
        ) : null}

        <AnimatePresence mode="popLayout" initial={false}>
          {!isLoading &&
            !isError &&
            notifications.map((notification) => (
              <m.div
                key={notification.id}
                layout={shouldReduceMotion ? false : "position"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.2,
                  ease: "easeInOut",
                }}
              >
                <NotificationCard
                  notification={notification}
                  onClick={() => onNotificationClick?.(notification)}
                />
              </m.div>
            ))}
        </AnimatePresence>

        {/* Infinite scroll trigger */}
        {!isLoading && !isError && hasNextPage && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Spinner className="size-5 text-muted-foreground" />}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
