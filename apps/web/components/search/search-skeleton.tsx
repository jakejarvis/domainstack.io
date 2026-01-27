import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";

export type SearchSkeletonVariant = "sm" | "lg";

export function SearchSkeleton({
  variant = "lg",
  className,
}: {
  variant?: SearchSkeletonVariant;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col gap-5", className)}>
      <div className="relative w-full flex-1">
        <div
          className={cn(
            "flex w-full animate-pulse items-center gap-3 rounded-lg bg-muted/30 px-3 ring-1 ring-border/60",
            variant === "lg" ? "h-12" : "h-10",
          )}
        >
          {/* Search icon placeholder */}
          <Skeleton className="size-5 shrink-0" />

          {/* Input text placeholder */}
          <Skeleton className="h-4 flex-1" />

          {/* Right side addon placeholder */}
          {variant === "lg" ? (
            // Inspect button placeholder (homepage)
            <Skeleton className="h-8 w-20 shrink-0" />
          ) : (
            // Keyboard shortcut placeholder (header)
            <Skeleton className="hidden h-6 w-14 shrink-0 sm:block" />
          )}
        </div>
      </div>
    </div>
  );
}
