"use client";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { useIsClient } from "@/hooks/use-is-client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { cn } from "@domainstack/ui/utils";

export function AppHeaderGrid({ children }: { children: React.ReactNode }) {
  const { isOpen: isSearchOpen } = useMobileSearch();
  const isMobile = useIsMobile();
  const mounted = useIsClient();
  const { direction, isPastThreshold } = useScrollDirection({
    threshold: 15,
  });

  // On mobile past threshold, hide/show based on scroll direction
  const shouldHideHeader = isMobile && isPastThreshold && direction === "down";

  return (
    <>
      <header
        className={cn(
          // Collapsed columns live in CSS so the first paint is right: a
          // JS-only template would flash a full-width search bar on mobile.
          "top-0 right-0 left-0 z-100 grid h-[var(--header-height)] grid-cols-[auto_0px_1fr] items-center gap-4 border-b border-black/15 bg-background/80 px-4 backdrop-blur transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none md:grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] dark:border-white/10",
          "md:sticky md:right-auto md:left-auto",
          // Mobile transform logic:
          // - Before threshold: behave like a normal element (scrolls away with the page)
          // - Past threshold + scrolling down: stay at -100% (hidden)
          // - Past threshold + scrolling up: translate to 0 (visible)
          isMobile &&
            (isPastThreshold
              ? shouldHideHeader
                ? "fixed -translate-y-full" // Hidden (no transition - instant hide)
                : "fixed translate-y-0 transition-transform duration-300 ease-out" // Visible (animate reveal)
              : "absolute translate-y-0"), // Natural scroll (no scroll-linked transforms)
        )}
        // Omit the inline style pre-mount so no override fights those classes,
        // and skip it on desktop so the `md:` class stays the source of truth.
        // A CSS transition (not JS/rAF) drives the width change so it keeps
        // animating smoothly even while typing forces synchronous re-renders.
        style={
          mounted && isMobile
            ? { gridTemplateColumns: isSearchOpen ? "auto 1fr 0px" : "auto 0px 1fr" }
            : undefined
        }
      >
        {children}
      </header>

      {/* Spacer to prevent content jump when header is fixed/absolute on mobile */}
      {isMobile && <div className="h-[var(--header-height)]" aria-hidden />}
    </>
  );
}
