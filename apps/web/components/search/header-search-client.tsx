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
        // `overflow-hidden` clips descendant box-shadows on both axes, and the
        // input's focus ring is a 3px shadow spread. Inset the clip box by 4px all
        // round (padding) and pull it back out (negative margin) so the ring has
        // room without shifting the input's own box or the header's height.
        "-mt-1 -mb-1 -ml-1 p-1",
        // The collapsed icon column is 0px wide but still takes a grid gap, so the
        // expanded input would sit 16px left of centre. Reclaim that dead gap.
        isOpen ? "-mr-5 md:-mr-1" : "-mr-1",
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
      {/* `min-w-0` so the input group can shrink below its intrinsic width —
          otherwise `justify-center` overflows it symmetrically and the left edge
          lands outside the clip box. */}
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
