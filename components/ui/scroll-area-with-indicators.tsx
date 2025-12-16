"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, type RefObject, useEffect, useRef } from "react";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { cn } from "@/lib/utils";

interface ScrollAreaWithIndicatorsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to show indicators (can disable for non-scrollable content) */
  showIndicators?: boolean;
}

/**
 * A scrollable container that shows subtle shadow indicators
 * when there's more content above or below the visible area.
 */
export const ScrollAreaWithIndicators = forwardRef<
  HTMLDivElement,
  ScrollAreaWithIndicatorsProps
>(({ children, className, showIndicators = true, ...props }, forwardedRef) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ref = (forwardedRef as RefObject<HTMLDivElement>) || internalRef;

  const {
    showStart: canScrollUp,
    showEnd: canScrollDown,
    update,
  } = useScrollIndicators({
    containerRef: ref,
    direction: "vertical",
    threshold: 5,
  });

  // Also observe the content wrapper - this catches when children expand/collapse
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top scroll shadow */}
      {showIndicators && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black/15 to-transparent transition-opacity duration-200 dark:from-black/40",
            canScrollUp ? "opacity-100" : "opacity-0",
          )}
          aria-hidden="true"
        />
      )}

      {/* Scrollable content */}
      <div
        ref={ref}
        className={cn("min-h-0 flex-1 overflow-y-auto", className)}
        {...props}
      >
        {/* Inner wrapper to observe content height changes (e.g., collapsibles) */}
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Bottom scroll indicator with shadow and chevron */}
      {showIndicators && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center transition-opacity duration-200",
            canScrollDown ? "opacity-100" : "opacity-0",
          )}
          aria-hidden="true"
        >
          {/* Gradient shadow */}
          <div className="h-12 w-full bg-gradient-to-t from-black/20 to-transparent dark:from-black/50" />
          {/* Chevron indicator */}
          <div className="absolute bottom-1 flex items-center justify-center">
            <ChevronDown className="size-5 animate-bounce text-muted-foreground/70" />
          </div>
        </div>
      )}
    </div>
  );
});

ScrollAreaWithIndicators.displayName = "ScrollAreaWithIndicators";
