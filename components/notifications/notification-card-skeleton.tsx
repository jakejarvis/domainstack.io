import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a single notification card matching NotificationCard layout.
 */
export function NotificationCardSkeleton() {
  return (
    <div className="w-full p-3">
      <div className="flex gap-3">
        {/* Icon */}
        <Skeleton className="size-8 shrink-0 rounded-lg" />

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            {/* Unread dot */}
            <Skeleton className="mt-0.5 size-2 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          {/* Timestamp */}
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
