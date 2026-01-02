import { NotificationCardSkeleton } from "./notification-card-skeleton";

interface NotificationListSkeletonProps {
  /** Number of skeleton cards to render. Defaults to 4. */
  count?: number;
}

export function NotificationListSkeleton({
  count = 4,
}: NotificationListSkeletonProps) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <NotificationCardSkeleton key={index} />
      ))}
    </div>
  );
}
