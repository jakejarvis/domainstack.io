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
          // CSS-driven (base + data-attribute variant) so first paint is
          // right instead of flashing a full-width search bar on mobile.
          "grid-cols-[auto_0px_1fr] duration-300 ease-out motion-reduce:transition-none max-md:data-[search-open=true]:grid-cols-[auto_1fr_0px] md:grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr]",
          // Mobile: scrolls with the page until past the threshold, then pins,
          // hiding instantly on scroll-down and animating back in on scroll-up.
          isPastThreshold ? "max-md:fixed" : "max-md:absolute",
          isScrolledAway
            ? "transition-[grid-template-columns] max-md:-translate-y-full"
            : "transition-[grid-template-columns,translate]",
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
        // Mobile only: min-w-0 + overflow-hidden so this tracks its collapsing
        // column instead of overflowing into the search box. On desktop the
        // `1fr` track must size to the actions, or they get clipped.
        "flex h-full items-center justify-end gap-1.5 max-md:min-w-0 max-md:overflow-hidden",
        // Fade reads the `group/header` + data-search-open set by AppHeaderGrid.
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none max-md:group-data-[search-open=true]/header:translate-x-4 max-md:group-data-[search-open=true]/header:opacity-0",
      )}
      // inert can't be expressed in CSS; drops the faded actions from focus.
      inert={isHidden || undefined}
    >
      {children}
    </div>
  );
}
