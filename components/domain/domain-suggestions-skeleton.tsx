import { cn } from "@/lib/utils";

export function DomainSuggestionsSkeleton({
  className,
  count = 5,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden py-0.5">
        <div className="flex gap-2 px-0.5 pb-2">
          {Array.from({ length: count }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fine for skeletons
              key={i}
              className="flex h-8 flex-shrink-0 animate-pulse items-center gap-2 rounded-md bg-muted/15 px-3 ring-1 ring-border/60"
            >
              {/* Favicon placeholder */}
              <div className="size-4 rounded bg-muted/50" />
              {/* Domain text placeholder with varying widths */}
              <div
                className="h-3.5 rounded bg-muted/50"
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
