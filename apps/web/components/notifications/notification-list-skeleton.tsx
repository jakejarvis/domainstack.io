import { NotificationCardSkeleton } from "@/components/notifications/notification-card-skeleton";

interface NotificationListSkeletonProps {
  /** Number of skeleton cards to render. Defaults to 4. */
  count?: number;
}

export function NotificationListSkeleton({ count = 4 }: NotificationListSkeletonProps) {
  const skeletonIds = Array.from(
    { length: count },
    (_, itemNumber) => `notification-skeleton-${itemNumber}`,
  );

  return (
    <div className="divide-y">
      {skeletonIds.map((skeletonId) => (
        <NotificationCardSkeleton key={skeletonId} />
      ))}
    </div>
  );
}
