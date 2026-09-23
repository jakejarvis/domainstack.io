"use client";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { cn } from "@domainstack/ui/utils";

export function AppHeaderGrid({ children }: { children: React.ReactNode }) {
  const { isOpen: isSearchOpen } = useMobileSearch();
  const { direction, isPastThreshold } = useScrollDirection({
    threshold: 15,
  });
  const isScrolledAway = isPastThreshold && direction === "down";

  return (
    <>
      <header
        data-search-open={isSearchOpen}
        data-scrolled-away={isScrolledAway}
        className={cn(
          "group/header top-0 right-0 left-0 z-100 grid h-[var(--header-height)] items-center gap-4 px-4 md:sticky md:right-auto md:left-auto",
          "border-b border-black/15 bg-background/80 backdrop-blur dark:border-white/10",
          // Mobile: the search and actions share the second column and
          // crossfade (see HeaderSearchClient/AppHeaderActions). Animating the
          // column widths instead relays out every frame, which stutters on iOS.
          "grid-cols-[auto_1fr] duration-300 ease-out motion-reduce:transition-none md:grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr]",
          // Mobile: scrolls with the page until past the threshold, then pins,
          // hiding instantly on scroll-down and animating back in on scroll-up.
          isPastThreshold ? "max-md:fixed" : "max-md:absolute",
          isScrolledAway ? "max-md:-translate-y-full" : "transition-[translate]",
        )}
      >
        {children}
      </header>

      {/* Holds the header's space on mobile, where it's absolute/fixed */}
      <div className="h-[var(--header-height)] md:hidden" aria-hidden />
    </>
  );
}

export function AppHeaderActions({ children }: { children: React.ReactNode }) {
  const { isOpen: isSearchOpen } = useMobileSearch();
  const isMobile = useIsMobile();
  // Only animate on mobile; on desktop keep fully visible.
  const isHidden = isMobile && isSearchOpen;

  return (
    <div
      className={cn(
        // Mobile: shares the second column with the header search.
        "flex h-full items-center justify-end gap-1.5 max-md:col-start-2 max-md:row-start-1",
        // Fade reads the `group/header` + data-search-open set by AppHeaderGrid.
        "transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none max-md:group-data-[search-open=true]/header:translate-x-4 max-md:group-data-[search-open=true]/header:opacity-0",
        // Sits above the search in paint order; let taps fall through to it.
        "max-md:group-data-[search-open=true]/header:pointer-events-none",
      )}
      // inert can't be expressed in CSS; drops the faded actions from focus.
      inert={isHidden || undefined}
    >
      {children}
    </div>
  );
}
