import { MAX_HISTORY_ITEMS } from "@domainstack/constants";
import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

export function HomeSearchSuggestionsSkeleton({
  className,
  count = MAX_HISTORY_ITEMS,
}: {
  className?: string;
  count?: number;
}) {
  const skeletonItems = Array.from({ length: count }, (_, itemNumber) => ({
    id: `home-search-suggestion-skeleton-${itemNumber}`,
    width: 80 + ((itemNumber * 20) % 60),
  }));

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden py-0.5">
        <div className="flex gap-2 pl-0.5">
          {skeletonItems.map((item) => (
            <div
              key={item.id}
              className="flex h-8 shrink-0 animate-pulse items-center gap-2 rounded-md bg-muted/15 px-2.5 ring-1 ring-border/60"
            >
              {/* Favicon placeholder */}
              <Skeleton className="size-4 rounded-sm" />
              {/* Domain text placeholder with varying widths */}
              <Skeleton
                className="h-3.5"
                style={{
                  width: `${item.width}px`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Static right gradient to indicate more content */}
      <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
