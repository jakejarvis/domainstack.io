"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down" | null;

interface UseScrollDirectionOptions {
  /** Minimum scroll delta to trigger direction change (prevents jitter) */
  threshold?: number;
  /** Scroll position threshold before hide/show behavior kicks in */
  offsetThreshold?: number;
  /** Initial direction before any scroll */
  initialDirection?: ScrollDirection;
}

interface UseScrollDirectionResult {
  /** Current scroll direction */
  direction: ScrollDirection;
  /** Whether we've scrolled past the offset threshold */
  isPastThreshold: boolean;
}

/**
 * Hook that tracks scroll direction with hysteresis to prevent jitter.
 * Also tracks whether we've scrolled past an offset threshold.
 */
export function useScrollDirection({
  threshold = 10,
  offsetThreshold = 80,
  initialDirection = null,
}: UseScrollDirectionOptions = {}): UseScrollDirectionResult {
  const [direction, setDirection] = useState<ScrollDirection>(initialDirection);
  const [isPastThreshold, setIsPastThreshold] = useState(false);
  const lastScrollY = useRef(0);
  const lastDirection = useRef<ScrollDirection>(initialDirection);
  const lastPastThreshold = useRef(false);

  useEffect(() => {
    // Initialize with current scroll position
    const initialScrollY = window.scrollY;
    lastScrollY.current = initialScrollY;
    const pastThreshold = initialScrollY > offsetThreshold;
    lastPastThreshold.current = pastThreshold;
    setIsPastThreshold(pastThreshold);

    // Set initial CSS variable for scroll position (used for header natural scroll)
    document.documentElement.style.setProperty(
      "--scroll-y",
      `${Math.min(initialScrollY, offsetThreshold)}px`,
    );

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      // Update CSS variable directly (no React state = no delay)
      // Clamped to threshold - past threshold it stays at max value
      document.documentElement.style.setProperty(
        "--scroll-y",
        `${Math.min(currentScrollY, offsetThreshold)}px`,
      );

      // Update threshold state (only when it changes)
      const pastThreshold = currentScrollY > offsetThreshold;
      if (pastThreshold !== lastPastThreshold.current) {
        lastPastThreshold.current = pastThreshold;
        setIsPastThreshold(pastThreshold);
      }

      // At the very top, always show header (direction = 'up')
      if (currentScrollY <= 0) {
        if (lastDirection.current !== "up") {
          lastDirection.current = "up";
          setDirection("up");
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      // Only update direction if scroll delta exceeds threshold
      if (Math.abs(delta) >= threshold) {
        const newDirection = delta > 0 ? "down" : "up";

        if (newDirection !== lastDirection.current) {
          lastDirection.current = newDirection;
          setDirection(newDirection);
        }

        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.documentElement.style.removeProperty("--scroll-y");
    };
  }, [threshold, offsetThreshold]);

  return { direction, isPastThreshold };
}
