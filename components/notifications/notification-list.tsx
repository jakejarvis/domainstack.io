"use client";

import type { RefObject } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { NotificationCard, type NotificationData } from "./notification-card";
import { NotificationEmptyState } from "./notification-empty-state";

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
}: NotificationListProps) {
  return (
    <ScrollArea
      viewportRef={scrollAreaRef}
      className="max-h-[480px] min-h-0 flex-1 bg-card"
      gradient
      gradientContext="card"
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="p-12 text-center text-destructive text-sm">
          Failed to load notifications
        </div>
      ) : notifications.length === 0 ? (
        <NotificationEmptyState variant={view} />
      ) : (
        <div className="divide-y">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onClick={() => onNotificationClick?.(notification)}
            />
          ))}

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
