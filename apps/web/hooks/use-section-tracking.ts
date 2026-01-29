import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseSectionTrackingOptions {
  /** IDs of sections to track */
  sectionIds: string[];
  /** Distance from top where section is considered "active" */
  scrollMarginPx: number;
}

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
 */
export function useSectionTracking({
  sectionIds,
  scrollMarginPx,
}: UseSectionTrackingOptions): UseSectionTrackingReturn {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? "");

  // Refs for programmatic scroll tracking
  const programmaticTargetIdRef = useRef<string | null>(null);
  const programmaticLockUntilRef = useRef<number>(0);

  // Memoize scrollMarginPx in ref to allow updates without effect re-run
  const scrollMarginRef = useRef(scrollMarginPx);
  scrollMarginRef.current = scrollMarginPx;

  // Section tracking effect
  useEffect(() => {
    if (sectionIds.length === 0) return;

    let rafId: number | null = null;

    const updateActiveSection = () => {
      const scrollMargin = scrollMarginRef.current;
      const targetId = programmaticTargetIdRef.current;

      // Check if we're in a programmatic scroll
      if (targetId) {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const targetEl = document.getElementById(targetId);

        if (!targetEl || now > programmaticLockUntilRef.current) {
          // Lock expired or target missing - resume normal tracking
          programmaticTargetIdRef.current = null;
        } else {
          // Check if we've landed on the target
          const { top } = targetEl.getBoundingClientRect();
          const isLanded = Math.abs(top - scrollMargin) <= 2;
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
        if (top - scrollMargin <= 1) {
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
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
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
