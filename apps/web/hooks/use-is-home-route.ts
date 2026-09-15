"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/**
 * True on the landing page, where the header search is hidden in favor of the
 * page's own search field. Uses `useSelectedLayoutSegment` rather than
 * `usePathname` so intercepted routes (like /settings) in the modal slot don't
 * change the answer.
 */
export function useIsHomeRoute(): boolean {
  const segment = useSelectedLayoutSegment();
  return segment === null || segment === "(landing)";
}
