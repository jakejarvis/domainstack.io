import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SettingsSkeletonProps {
  /** Whether to show the card wrapper with visual styling */
  showCard?: boolean;
}

/**
 * Loading skeleton for settings content.
 * Shows placeholders for both subscription and notification sections.
 */
export function SettingsSkeleton({ showCard = true }: SettingsSkeletonProps) {
  const content = (
    <div className={cn("space-y-6", !showCard && "py-1")}>
      {/* Subscription skeleton */}
      <div>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
        <CardContent className={showCard ? "space-y-4" : "space-y-4 px-0"}>
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </div>

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Notifications skeleton */}
      <div>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-1 h-4 w-56" />
        </CardHeader>
        <CardContent className={showCard ? "space-y-3" : "space-y-3 px-0 pb-0"}>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </CardContent>
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return <Card className="overflow-hidden">{content}</Card>;
}
