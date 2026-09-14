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
        // On mobile the grid collapses this column to 0px while closed. Clipping
        // alone would leave the input tabbable and announced, so hide it — and do
        // it in CSS at the same breakpoint the grid uses, because `useIsMobile()`
        // reports false until after the first paint while the collapsed layout is
        // already in the SSR markup. `visibility` (not `display`) keeps the input
        // mounted so `open()` can focus it synchronously and raise the keyboard.
        // The transition rides along only on the closing class, so content stays
        // on screen while the column shrinks; opening stays instant, because a
        // transition in flight is not yet `visible` when `open()` calls focus().
        !isOpen && "invisible transition-[visibility] duration-200 md:visible",
      )}
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
