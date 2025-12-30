"use client";

import { motion } from "motion/react";
import { useHeaderSearchFocus } from "@/components/search/header-search-context";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppHeaderSlideOver({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSearchFocused } = useHeaderSearchFocus();
  const isMobile = useIsMobile();

  return (
    <motion.div
      className="flex h-full items-center gap-1.5 justify-self-end"
      animate={{
        // Only animate on mobile; on desktop keep fully visible
        opacity: isMobile ? (isSearchFocused ? 0 : 1) : 1,
        x: isMobile ? (isSearchFocused ? 16 : 0) : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 600,
        damping: 35,
      }}
      initial={false}
      style={{ pointerEvents: isSearchFocused && isMobile ? "none" : "auto" }}
    >
      {children}
    </motion.div>
  );
}
