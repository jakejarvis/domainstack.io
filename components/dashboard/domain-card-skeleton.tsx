import { Skeleton } from "@/components/ui/skeleton";

type DomainCardSkeletonProps = {
  /** Number of info rows to show. Default is 3. */
  infoRows?: number;
};

/**
 * Skeleton for a single domain card matching TrackedDomainCard layout.
 * Used in both initial page load and infinite scroll loading states.
 */
export function DomainCardSkeleton({ infoRows = 3 }: DomainCardSkeletonProps) {
  return (
    <div className="rounded-xl border border-black/15 bg-background/60 p-6 dark:border-white/15">
      {/* Header: favicon + domain name + dropdown */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        <Skeleton className="size-8 rounded" />
      </div>
      {/* Info rows - configurable count */}
      <div className="mt-4 space-y-2">
        {Array.from({ length: infoRows }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fine for skeletons
          <Skeleton key={`info-row-${i}`} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
