import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a single notification card matching NotificationCard layout.
 */
export function NotificationCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Icon circle */}
            <Skeleton className="mt-0.5 size-9 rounded-full" />
            {/* Content */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          {/* Timestamp */}
          <Skeleton className="h-3 w-16" />
        </div>
      </CardHeader>
    </Card>
  );
}
