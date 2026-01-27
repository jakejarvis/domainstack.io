"use client";

import { motion } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useHeaderSearchStore } from "@/lib/stores/header-search-store";
import { cn } from "@/lib/utils";

export function AppHeaderGrid({ children }: { children: React.ReactNode }) {
  const isSearchFocused = useHeaderSearchStore((s) => s.isSearchFocused);
  const isMobile = useIsMobile();
  const { direction, isPastThreshold } = useScrollDirection({
    threshold: 15,
  });

  // On mobile past threshold, hide/show based on scroll direction
  const shouldHideHeader = isMobile && isPastThreshold && direction === "down";

  return (
    <>
      <motion.header
        className={cn(
          "top-0 right-0 left-0 z-100 grid h-[var(--header-height)] grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] items-center gap-4 border-black/15 border-b bg-background/80 py-3 pr-4 pl-6 backdrop-blur dark:border-white/10",
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

      {/* Spacer to prevent content jump when header is fixed/absolute on mobile */}
      {isMobile && <div className="h-[var(--header-height)]" aria-hidden />}
    </>
  );
}
