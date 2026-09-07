import { Skeleton } from "@domainstack/ui/skeleton";

/**
 * Skeleton for a single notification card matching NotificationCard layout.
 */
export function NotificationCardSkeleton() {
  return (
    <div className="w-full p-3">
      <div className="flex gap-3">
        {/* Icon — Icon size="sm" is size-8 rounded-full */}
        <Skeleton className="size-8 shrink-0 rounded-full" />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-32" />
            {/* Unread dot */}
            <Skeleton className="mt-0.5 size-2 shrink-0 rounded-full" />
          </div>
          <Skeleton className="mt-0.5 h-[13px] w-full" />
          <Skeleton className="mt-0.5 h-[13px] w-3/4" />
          {/* Timestamp — mt-1 text-xs */}
          <Skeleton className="mt-1 h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
