"use client";

import { useCallback } from "react";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { SearchClient } from "@/components/search/search-client";
import { useIsHomeRoute } from "@/hooks/use-is-home-route";
import { useIsMobile } from "@/hooks/use-mobile";

export function HeaderSearchClient() {
  const { isOpen, open, close, inputRef } = useMobileSearch();
  const isMobile = useIsMobile();
  const isHome = useIsHomeRoute();

  const handleClose = useCallback(() => close(), [close]);
  const handleDismiss = useCallback(() => close({ returnFocus: true }), [close]);

  // Return empty div to avoid messing up header grid layout
  if (isHome) return <div className="flex flex-1" />;

  // On mobile the grid collapses this column to 0px while closed, so it must clip
  // its contents and stay out of the tab order / a11y tree. The input itself stays
  // mounted so `open()` can focus it synchronously and raise the mobile keyboard.
  const isCollapsed = isMobile && !isOpen;

  return (
    <div
      id="header-search"
      className="flex min-w-0 flex-1 justify-center overflow-hidden"
      inert={isCollapsed || undefined}
    >
      <div className="w-full max-w-2xl">
        <SearchClient
          variant="sm"
          inputRef={inputRef}
          onCloseAction={handleClose}
          onDismissAction={handleDismiss}
          onHotkeyAction={open}
        />
      </div>
    </div>
  );
}
