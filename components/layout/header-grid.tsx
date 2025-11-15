"use client";

import { motion } from "motion/react";
import { useHeaderSearchFocus } from "@/components/layout/header-search-context";
import { useIsMobile } from "@/hooks/use-mobile";

export function HeaderGrid({ children }: { children: React.ReactNode }) {
  const { isSearchFocused } = useHeaderSearchFocus();
  const isMobile = useIsMobile();

  return (
    <motion.header
      className="sticky top-0 z-40 grid h-20 grid-cols-[1fr_minmax(0,var(--container-2xl))_1fr] items-center gap-4 border-b bg-background/60 py-3 pr-4 pl-6 backdrop-blur"
      animate={{
        gridTemplateColumns: isMobile
          ? isSearchFocused
            ? "auto 1fr 0px"
            : "auto 1fr auto"
          : "",
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 40,
      }}
      initial={false}
    >
      {children}
    </motion.header>
  );
}
