"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppHeaderSlideOver({ children }: { children: React.ReactNode }) {
  const { isOpen: isSearchOpen } = useMobileSearch();
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const isHidden = isMobile && isSearchOpen;

  return (
    <m.div
      className="flex h-full items-center gap-1.5 justify-self-end"
      animate={{
        // Only animate on mobile; on desktop keep fully visible
        opacity: isHidden ? 0 : 1,
        x: isHidden && !shouldReduceMotion ? 16 : 0,
      }}
      transition={
        shouldReduceMotion
          ? { duration: 0.1 }
          : {
              type: "spring",
              stiffness: 600,
              damping: 35,
            }
      }
      initial={false}
      // `inert` also drops the hidden cluster from the tab order and a11y tree.
      inert={isHidden || undefined}
    >
      {children}
    </m.div>
  );
}
