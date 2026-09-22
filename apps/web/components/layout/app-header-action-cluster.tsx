"use client";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@domainstack/ui/utils";

export function AppHeaderActionCluster({ children }: { children: React.ReactNode }) {
  const { isOpen: isSearchOpen } = useMobileSearch();
  const isMobile = useIsMobile();
  // Only animate on mobile; on desktop keep fully visible.
  const isHidden = isMobile && isSearchOpen;

  return (
    <div
      className={cn(
        "flex h-full items-center gap-1.5 justify-self-end transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        isHidden ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100",
      )}
      // `inert` also drops the hidden cluster from the tab order and a11y tree.
      inert={isHidden || undefined}
    >
      {children}
    </div>
  );
}
