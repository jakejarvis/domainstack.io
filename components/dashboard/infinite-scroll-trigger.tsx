"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type InfiniteScrollTriggerProps = {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  /** Distance from viewport to trigger load (in pixels) */
  threshold?: number;
};

/**
 * Invisible trigger element that loads more items when scrolled into view.
 * Uses Intersection Observer for efficient scroll detection.
 */
export function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 200,
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0,
      },
    );

    observer.observe(trigger);

    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoading, threshold]);

  // Nothing to show if no more items
  if (!hasMore && !isLoading) return null;

  return (
    <div ref={triggerRef} className="w-full py-4">
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading more domains...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton cards shown while loading more items in the grid.
 */
export function InfiniteScrollSkeletons({ count = 3 }: { count?: number }) {
  // Generate stable keys for skeleton elements (they never reorder)
  const skeletonKeys = Array.from(
    { length: count },
    (_, i) => `loading-skeleton-${i}`,
  );

  return (
    <>
      {skeletonKeys.map((key) => (
        <div
          key={key}
          className="rounded-xl border border-black/15 bg-background/60 p-6 dark:border-white/15"
        >
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
          {/* Info rows */}
          <div className="mt-4 space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </>
  );
}
