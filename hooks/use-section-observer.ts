"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
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
function getScrollMarginFromCSS(): number {
  const headerHeight = getCSSVarPx("--header-height", HEADER_HEIGHT);
  const sectionNavHeight = getCSSVarPx(
    "--section-nav-height",
    SECTION_NAV_HEIGHT,
  );
  const scrollPadding = getCSSVarPx("--scroll-padding", SCROLL_PADDING);
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
export function useSectionObserver({
  sectionIds,
  headerRef,
}: UseSectionObserverOptions): UseSectionObserverReturn {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? "");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // Check for reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Track visible sections with their intersection ratios for priority selection
  const visibleSectionsRef = useRef<Map<string, number>>(new Map());

  // Lock to prevent observer updates during programmatic scrolling
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section observer - tracks which section is in the top portion of viewport
  useEffect(() => {
    if (sectionIds.length === 0) return;

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      // Always update the visibility map (even during programmatic scrolling)
      for (const entry of entries) {
        const id = entry.target.id;
        if (entry.isIntersecting) {
          visibleSectionsRef.current.set(id, entry.intersectionRatio);
        } else {
          visibleSectionsRef.current.delete(id);
        }
      }

      // Skip active section updates during programmatic scrolling to prevent jitter
      if (isScrollingRef.current) return;

      // Select the first visible section in document order
      const visibleInOrder = sectionIds.filter((id) =>
        visibleSectionsRef.current.has(id),
      );

      if (visibleInOrder.length > 0) {
        setActiveSection(visibleInOrder[0]);
      }
    };

    // Read scroll margin from CSS variables for consistency with CSS scroll-margin-top
    const scrollMarginPx = getScrollMarginFromCSS();

    // rootMargin: negative top margin accounts for sticky headers
    // -60% from bottom means we detect when section enters top 40% of viewport
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: `-${scrollMarginPx}px 0px -60% 0px`,
      threshold: [0, 0.1],
    });

    // Observe all sections
    for (const id of sectionIds) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [sectionIds]);

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

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Smooth scroll to section - relies on CSS scroll-margin-top for offset
  const scrollToSection = useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (!element) return;

      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Lock observer updates during scroll
      isScrollingRef.current = true;

      // Update active section immediately for responsive feedback
      setActiveSection(id);

      const scrollTarget = document.documentElement;
      // Capture scroll position before initiating scroll to validate scrollend source
      const scrollTopAtStart = scrollTarget.scrollTop;

      element.scrollIntoView({
        behavior: prefersReducedMotion ? "instant" : "smooth",
        block: "start",
      });

      // Unlock when scroll completes
      if (prefersReducedMotion) {
        // Instant scroll - unlock immediately
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = false;
        }, 50);
      } else {
        // Track whether the document has scrolled (vs scrollend from other sources)
        let documentScrolled = false;

        const unlockScroll = () => {
          // Check if document actually scrolled - filters scrollend events from other
          // scroll sources (e.g., horizontal tab scroll in section-nav which scrolls
          // its own container, not document.documentElement)
          if (!documentScrolled) {
            documentScrolled = scrollTarget.scrollTop !== scrollTopAtStart;
          }

          // If document scroll position unchanged and we're not at the target,
          // this is likely a spurious scrollend from a different scroll source
          if (!documentScrolled) {
            // Check if already at target (clicked on current section)
            const rect = element.getBoundingClientRect();
            // Read expected position from CSS variables for consistency
            const expectedTop = getScrollMarginFromCSS();
            const isAtTarget = Math.abs(rect.top - expectedTop) < 5;

            if (!isAtTarget) {
              // Re-listen for the real scrollend
              scrollTarget.addEventListener("scrollend", unlockScroll, {
                once: true,
              });
              return;
            }
          }

          isScrollingRef.current = false;
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
        };

        // Listen for scrollend on the document element (main page scroll)
        scrollTarget.addEventListener("scrollend", unlockScroll, {
          once: true,
        });

        // Fallback timeout in case scrollend doesn't fire (older browsers)
        scrollTimeoutRef.current = setTimeout(() => {
          scrollTarget.removeEventListener("scrollend", unlockScroll);
          isScrollingRef.current = false;
        }, 1500);
      }
    },
    [prefersReducedMotion],
  );

  return {
    activeSection,
    isHeaderVisible,
    scrollToSection,
  };
}
