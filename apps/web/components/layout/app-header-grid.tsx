"use client";

import * as m from "motion/react-m";

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
      <m.header
        className={cn(
          // Collapsed columns live in CSS so the first paint is right: a
          // JS-only template would flash a full-width search bar on mobile.
          "top-0 right-0 left-0 z-100 grid h-[var(--header-height)] grid-cols-[auto_0px_1fr] items-center gap-4 border-b border-black/15 bg-background/80 px-4 backdrop-blur md:grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] dark:border-white/10",
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
        // Omit the key pre-mount so no inline style overrides those classes.
        animate={
          mounted
            ? {
                gridTemplateColumns: isMobile
                  ? isSearchOpen
                    ? "auto 1fr 0px"
                    : "auto 0px 1fr"
                  : "1fr minmax(0, var(--container-2xl)) 1fr",
              }
            : {}
        }
        transition={{
          gridTemplateColumns: { type: "spring", stiffness: 400, damping: 40 },
        }}
        initial={false}
      >
        {children}
      </m.header>

      {/* Spacer to prevent content jump when header is fixed/absolute on mobile */}
      {isMobile && <div className="h-[var(--header-height)]" aria-hidden />}
    </>
  );
}
