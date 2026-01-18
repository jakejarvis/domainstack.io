"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  HEADER_HEIGHT,
  SCROLL_PADDING,
  SECTION_NAV_HEIGHT,
} from "@/lib/constants/layout";

/**
 * Reads a CSS variable as a pixel number from the document root.
 * Falls back to the provided default if the variable is not set or invalid.
 */
function getCSSVarPx(name: string, fallback: number): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Gets the current scroll margin from CSS variables.
 * This ensures consistency with what CSS is actually using for scroll-margin-top.
 */
function getScrollMarginFromCSS(isMobile: boolean): number {
  const sectionNavHeight = getCSSVarPx(
    "--section-nav-height",
    SECTION_NAV_HEIGHT,
  );
  const scrollPadding = getCSSVarPx("--scroll-padding", SCROLL_PADDING);
  // Match `components/domain/report-section.tsx` scroll-mt behavior:
  // - mobile: section nav + padding
  // - md+: global header + section nav + padding
  const headerHeight = !isMobile
    ? getCSSVarPx("--header-height", HEADER_HEIGHT)
    : 0;
  return headerHeight + sectionNavHeight + scrollPadding;
}

interface UseSectionObserverOptions {
  sectionIds: string[];
  headerRef: React.RefObject<HTMLElement | null>;
}

interface UseSectionObserverReturn {
  activeSection: string;
  isHeaderVisible: boolean;
  scrollToSection: (id: string) => void;
}

/**
 * Hook that tracks which section is currently in view and whether the page header is visible.
 * Used for sticky section navigation with "context injection" pattern.
 *
 * @param options.sectionIds - Array of section element IDs to observe
 * @param options.headerRef - Ref to the page header element for visibility detection
 */
export function useReportSectionObserver({
  sectionIds,
  headerRef,
}: UseSectionObserverOptions): UseSectionObserverReturn {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? "");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // Check if the device is mobile
  const isMobile = useIsMobile();

  // When navigating via tab click, keep the clicked tab active until the scroll
  // has effectively landed. This prevents the scrollspy from briefly selecting
  // a neighbor section mid-animation.
  const programmaticTargetIdRef = useRef<string | null>(null);
  const programmaticLockUntilRef = useRef<number>(0);

  // Section tracking - computes active section based on section positions
  useEffect(() => {
    if (sectionIds.length === 0) return;

    let rafId: number | null = null;
    let scrollMarginPx = getScrollMarginFromCSS(isMobile);

    const updateActiveSection = () => {
      // During programmatic scrolling, keep the clicked section active until
      // it reaches its expected position (or we time out).
      const targetId = programmaticTargetIdRef.current;
      if (targetId) {
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const targetEl = document.getElementById(targetId);

        if (!targetEl || now > programmaticLockUntilRef.current) {
          programmaticTargetIdRef.current = null;
        } else {
          const { top } = targetEl.getBoundingClientRect();
          const isLanded = Math.abs(top - scrollMarginPx) <= 2;
          if (!isLanded) {
            setActiveSection((prev) => (prev === targetId ? prev : targetId));
            return;
          }

          programmaticTargetIdRef.current = null;
        }
      }

      const sectionEls = sectionIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el instanceof HTMLElement);

      // Pick the last section whose top has crossed the effective "top boundary"
      // (below sticky nav + padding). This avoids "skipping" short sections when
      // the previous section remains partially visible.
      let nextActive = sectionEls[0]?.id ?? sectionIds[0] ?? "";
      for (const el of sectionEls) {
        const { top } = el.getBoundingClientRect();
        if (top - scrollMarginPx <= 1) {
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

    const handleResize = () => {
      scrollMarginPx = getScrollMarginFromCSS(isMobile);
      scheduleUpdate();
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    // Initial computation
    scheduleUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [sectionIds, isMobile]);

  // Header observer - tracks if page header is visible for context injection
  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Header is visible if any part of it intersects the viewport
        setIsHeaderVisible(entries[0].isIntersecting);
      },
      {
        threshold: 0,
        // Small negative margin to trigger slightly before header fully exits
        rootMargin: "-10px 0px 0px 0px",
      },
    );

    observer.observe(headerElement);

    return () => observer.disconnect();
  }, [headerRef]);

  // Smooth scroll to section - relies on CSS scroll-margin-top for offset
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    // Update active section immediately for responsive feedback
    setActiveSection(id);
    programmaticTargetIdRef.current = id;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    // Smooth scroll duration varies; we just need a short lock to prevent
    // mid-animation flicker. Timeout is a safety valve.
    programmaticLockUntilRef.current = now + 1500;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return {
    activeSection,
    isHeaderVisible,
    scrollToSection,
  };
}
