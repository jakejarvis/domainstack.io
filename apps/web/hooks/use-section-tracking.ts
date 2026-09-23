import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseSectionTrackingReturn {
  /** Currently active section ID */
  activeSection: string;
  /** Scroll to a section by ID with smooth scrolling */
  scrollToSection: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Tracks which section is currently active based on scroll position.
 *
 * Features:
 * - Updates active section as user scrolls
 * - Handles programmatic scrolling with lock period to prevent jitter
 * - Uses RAF for performance
 * - Handles resize events
 * - Reads each section's CSS `scroll-margin-top` as its activation line, so the offset
 *   always matches where `scrollIntoView` lands
 *
 * `sectionIds` must be referentially stable, or the listeners re-subscribe every render.
 */
export function useSectionTracking(sectionIds: string[]): UseSectionTrackingReturn {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? "");

  // Refs for programmatic scroll tracking
  const programmaticTargetIdRef = useRef<string | null>(null);
  const programmaticLockUntilRef = useRef<number>(0);

  // Section tracking effect
  useEffect(() => {
    if (sectionIds.length === 0) return;

    let rafId: number | null = null;

    const updateActiveSection = () => {
      const targetId = programmaticTargetIdRef.current;

      // Check if we're in a programmatic scroll
      if (targetId) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const targetEl = document.getElementById(targetId);

        if (!targetEl || now > programmaticLockUntilRef.current) {
          // Lock expired or target missing - resume normal tracking
          programmaticTargetIdRef.current = null;
        } else {
          // Check if we've landed on the target
          const { top } = targetEl.getBoundingClientRect();
          const isLanded = Math.abs(top - getScrollMargin(targetEl)) <= 2;
          if (!isLanded) {
            // Still scrolling - keep target as active
            setActiveSection((prev) => (prev === targetId ? prev : targetId));
            return;
          }
          // Landed - clear target and continue with normal tracking
          programmaticTargetIdRef.current = null;
        }
      }

      // Find active section based on scroll position
      const sectionEls = sectionIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el instanceof HTMLElement);

      let nextActive = sectionEls[0]?.id ?? sectionIds[0] ?? "";
      for (const el of sectionEls) {
        const { top } = el.getBoundingClientRect();
        if (top - getScrollMargin(el) <= 1) {
          nextActive = el.id;
        } else {
          break;
        }
      }

      setActiveSection((prev) => (prev === nextActive ? prev : nextActive));
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateActiveSection();
      });
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    scheduleUpdate(); // Initial update

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [sectionIds]);

  // Scroll to section with programmatic tracking
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    setActiveSection(id);
    programmaticTargetIdRef.current = id;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    programmaticLockUntilRef.current = now + 1500; // 1.5s lock period

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return {
    activeSection,
    scrollToSection,
  };
}

function getScrollMargin(el: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
}
