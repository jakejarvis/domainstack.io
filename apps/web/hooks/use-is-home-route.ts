"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/**
 * True on the landing page, where the header search is hidden in favor of the
 * page's own large search field.
 *
 * Uses `useSelectedLayoutSegment` rather than `usePathname` because it correctly
 * reflects the 'children' slot state even when intercepted routes (like
 * /settings) are active in the modal slot.
 */
export function useIsHomeRoute(): boolean {
  const segment = useSelectedLayoutSegment();
  return segment === null || segment === "(landing)";
}
