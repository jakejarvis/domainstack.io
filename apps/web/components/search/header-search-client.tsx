"use client";

import { useCallback } from "react";

import { useMobileSearch } from "@/components/layout/mobile-search-context";
import { SearchClient } from "@/components/search/search-client";
import { useIsHomeRoute } from "@/hooks/use-is-home-route";
import { cn } from "@domainstack/ui/utils";

export function HeaderSearchClient() {
  const { isOpen, open, close, inputRef } = useMobileSearch();
  const isHome = useIsHomeRoute();

  const handleClose = useCallback(() => close(), [close]);
  const handleDismiss = useCallback(() => close({ returnFocus: true }), [close]);

  // Return empty div to avoid messing up header grid layout
  if (isHome) return <div className="flex flex-1" />;

  return (
    <div
      id="header-search"
      className={cn(
        "flex min-w-0 flex-1 justify-center overflow-hidden",
        // Inset the clip box so it doesn't cut the input's 3px focus ring.
        "-mt-1 -mb-1 -ml-1 p-1",
        // Reclaims the 0px column's grid gap so the expanded input centers.
        isOpen ? "-mr-5 md:-mr-1" : "-mr-1",
        // Reads `isOpen` directly so this class updates in the same
        // synchronous commit `open()` focuses in.
        !isOpen && "invisible transition-[visibility] duration-200 md:visible",
      )}
    >
      {/* min-w-0 so the input group shrinks to the track instead of overflowing it */}
      <div className="w-full max-w-2xl min-w-0">
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
