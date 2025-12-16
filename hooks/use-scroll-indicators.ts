import { type RefObject, useEffect, useRef, useState } from "react";

type ScrollDirection = "horizontal" | "vertical";

interface UseScrollIndicatorsOptions {
  containerRef: RefObject<HTMLElement | null>;
  direction?: ScrollDirection;
  threshold?: number;
}

interface UseScrollIndicatorsReturn {
  showStart: boolean;
  showEnd: boolean;
  update: () => void;
}

/**
 * Hook to detect scroll position and show indicators for overflowing content.
 * Supports both horizontal and vertical scroll detection with RAF throttling.
 *
 * @param containerRef - Ref to the scrollable container element
 * @param direction - Scroll direction: 'horizontal' or 'vertical' (default: 'horizontal')
 * @param threshold - Pixel threshold before showing indicators (default: 1 for horizontal, 5 for vertical)
 * @returns Object with showStart, showEnd booleans and manual update function
 */
export function useScrollIndicators({
  containerRef,
  direction = "horizontal",
  threshold,
}: UseScrollIndicatorsOptions): UseScrollIndicatorsReturn {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const rafIdRef = useRef<number | null>(null);
  const updateRef = useRef<(() => void) | null>(null);

  // Default threshold based on direction
  const effectiveThreshold = threshold ?? (direction === "horizontal" ? 1 : 5);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateIndicators = () => {
      // Cancel any pending frame
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Schedule update for next frame to throttle and prevent layout thrashing
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        if (!container) return;

        const shouldShowStart =
          direction === "horizontal"
            ? container.scrollLeft > effectiveThreshold
            : container.scrollTop > effectiveThreshold;

        const shouldShowEnd =
          direction === "horizontal"
            ? container.scrollLeft <
              container.scrollWidth - container.clientWidth - effectiveThreshold
            : container.scrollTop <
              container.scrollHeight -
                container.clientHeight -
                effectiveThreshold;

        // Only update state if values actually changed to prevent render loops
        setShowStart((prev) =>
          prev === shouldShowStart ? prev : shouldShowStart,
        );
        setShowEnd((prev) => (prev === shouldShowEnd ? prev : shouldShowEnd));
      });
    };

    updateRef.current = updateIndicators;

    // Initial check
    updateIndicators();

    const handleScroll = () => updateRef.current?.();

    // Update on scroll
    container.addEventListener("scroll", handleScroll, { passive: true });

    // Update on resize (in case content or container size changes)
    const resizeObserver = new ResizeObserver(() => updateRef.current?.());
    resizeObserver.observe(container);

    return () => {
      updateRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef, direction, effectiveThreshold]);

  return {
    showStart,
    showEnd,
    update: () => updateRef.current?.(),
  };
}
