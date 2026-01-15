"use client";

import { XCircleIcon } from "@phosphor-icons/react/ssr";
import { AnimatePresence, motion } from "motion/react";
import type { RefObject } from "react";
import { NotificationCard } from "@/components/notifications/notification-card";
import { NotificationEmptyState } from "@/components/notifications/notification-empty-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-list-skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationData } from "@/lib/types/notifications";

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
  return (
    <ScrollArea viewportRef={scrollAreaRef} className="min-h-0 flex-1 bg-card">
      {isLoading ? (
        <NotificationListSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-sm">
          <XCircleIcon className="size-4" />
          Failed to load notifications
        </div>
      ) : notifications.length === 0 ? (
        <NotificationEmptyState
          variant={view}
          onClosePopover={onClosePopover}
        />
      ) : (
        <div className="divide-y">
          <AnimatePresence mode="popLayout" initial={false}>
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <NotificationCard
                  notification={notification}
                  onClick={() => onNotificationClick?.(notification)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Infinite scroll trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <Spinner className="size-5 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );
}
