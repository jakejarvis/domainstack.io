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

  // Return empty div to avoid messing up the desktop header grid layout
  if (isHome) return <div className="flex flex-1 max-md:hidden" />;

  return (
    <div
      id="header-search"
      className={cn(
        "flex min-w-0 flex-1 justify-center overflow-hidden",
        // Inset the clip box so it doesn't cut the input's 3px focus ring.
        "-m-1 p-1",
        // Mobile: overlays the header actions in the second column and fades
        // in over them — opacity/translate only, so it stays on the compositor.
        "motion-reduce:transition-none max-md:col-start-2 max-md:row-start-1 max-md:duration-200 max-md:ease-out",
        // Reads `isOpen` directly so this class updates in the same
        // synchronous commit `open()` focuses in. `visibility` only transitions
        // on close: transitioning it on open keeps it hidden for the first
        // frame, so the synchronous focus would miss.
        isOpen
          ? "max-md:transition-[opacity,translate]"
          : "invisible max-md:translate-x-4 max-md:opacity-0 max-md:transition-[opacity,translate,visibility] md:visible",
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
