"use client";

import { motion, useReducedMotion } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHeaderSearchStore } from "@/lib/stores/header-search-store";

export function AppHeaderSlideOver({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSearchFocused = useHeaderSearchStore((s) => s.isSearchFocused);
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex h-full items-center gap-1.5 justify-self-end"
      animate={{
        // Only animate on mobile; on desktop keep fully visible
        opacity: isMobile ? (isSearchFocused ? 0 : 1) : 1,
        x: isMobile && !shouldReduceMotion ? (isSearchFocused ? 16 : 0) : 0,
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
      style={{ pointerEvents: isSearchFocused && isMobile ? "none" : "auto" }}
    >
      {children}
    </motion.div>
  );
}
