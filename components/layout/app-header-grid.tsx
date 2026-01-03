"use client";

import { motion } from "motion/react";
import { useHeaderSearchFocus } from "@/components/search/header-search-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { cn } from "@/lib/utils";

export function AppHeaderGrid({ children }: { children: React.ReactNode }) {
  const { isSearchFocused } = useHeaderSearchFocus();
  const isMobile = useIsMobile();
  const { direction, isPastThreshold } = useScrollDirection({
    threshold: 15,
    offsetThreshold: 80, // Header height
  });

  // On mobile past threshold, hide/show based on scroll direction
  const shouldHideHeader = isMobile && isPastThreshold && direction === "down";

  return (
    <>
      <motion.header
        className={cn(
          "fixed top-0 right-0 left-0 z-50 grid h-[var(--header-height)] grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] items-center gap-4 border-b bg-background/60 py-3 pr-4 pl-6 backdrop-blur",
          "md:sticky md:right-auto md:left-auto",
          // Mobile transform logic:
          // - Before threshold: translate by -scrollY (natural scroll)
          // - Past threshold + scrolling down: stay at -100% (hidden)
          // - Past threshold + scrolling up: translate to 0 (visible)
          isMobile &&
            (isPastThreshold
              ? shouldHideHeader
                ? "-translate-y-full" // Hidden (no transition - instant hide)
                : "translate-y-0 transition-transform duration-300 ease-out" // Visible (animate reveal)
              : "translate-y-[calc(var(--scroll-y,0px)*-1)]"), // Natural scroll (no transition)
        )}
        animate={{
          gridTemplateColumns: isMobile
            ? isSearchFocused
              ? "auto 1fr 0px"
              : "auto 1fr auto"
            : "",
        }}
        transition={{
          gridTemplateColumns: { type: "spring", stiffness: 400, damping: 40 },
        }}
        initial={false}
      >
        {children}
      </motion.header>

      {/* Spacer to prevent content jump when header is fixed on mobile */}
      <div className="h-[var(--header-height)] md:hidden" aria-hidden />
    </>
  );
}
