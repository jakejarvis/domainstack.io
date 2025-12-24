import { NotificationCardSkeleton } from "@/components/notifications/notification-card-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the notifications page.
 * Server component - no "use client" needed.
 */
export function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        {/* Tab list */}
        <div className="inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1">
          <Skeleton className="h-8 w-20 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-sm" />
        </div>

        {/* Loading state card */}
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Skeleton for notifications list with multiple cards.
 * Used when data is loading but tabs are interactive.
 */
export function NotificationsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fine for skeletons
        <NotificationCardSkeleton key={i} />
      ))}
    </div>
  );
}
