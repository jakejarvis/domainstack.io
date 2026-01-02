import type { RefObject } from "react";
import { NotificationCard } from "@/components/notifications/notification-card";
import { NotificationEmptyState } from "@/components/notifications/notification-empty-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-list-skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { NotificationData } from "@/lib/schemas";

interface NotificationListProps {
  notifications: NotificationData[];
  isLoading: boolean;
  isFetching: boolean;
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
  isFetching,
  isError,
  view,
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  scrollAreaRef,
  onNotificationClick,
}: NotificationListProps) {
  // Show loading state on initial load OR when fetching with no data (e.g., tab switch)
  const showLoading = isLoading || (isFetching && notifications.length === 0);

  return (
    <ScrollArea
      viewportRef={scrollAreaRef}
      className="max-h-[480px] min-h-0 flex-1 bg-card"
      gradient
      gradientContext="card"
    >
      {showLoading ? (
        <NotificationListSkeleton />
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
