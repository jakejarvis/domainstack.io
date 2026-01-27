import { MAX_HISTORY_ITEMS } from "@domainstack/constants";
import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@/lib/utils";

export function HomeSearchSuggestionsSkeleton({
  className,
  count = MAX_HISTORY_ITEMS,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden py-0.5">
        <div className="flex gap-2 pl-0.5">
          {Array.from({ length: count }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fine for skeletons
              key={i}
              className="flex h-8 shrink-0 animate-pulse items-center gap-2 rounded-md bg-muted/15 px-2.5 ring-1 ring-border/60"
            >
              {/* Favicon placeholder */}
              <Skeleton className="size-4 rounded-sm" />
              {/* Domain text placeholder with varying widths */}
              <Skeleton
                className="h-3.5"
                style={{
                  width: `${80 + ((i * 20) % 60)}px`,
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
