"use client";

import { atom } from "jotai";

/**
 * Selected domain IDs for dashboard multi-select. May hold IDs that are no
 * longer visible (e.g. archived from another tab); `useDashboardSelection`
 * intersects with the visible domains before reporting or acting on them.
 */
export const dashboardSelectedDomainIdsAtom = atom<Set<string>>(new Set<string>());

/**
 * Most recent domain selected through a checkbox. Direct selection actions do
 * not move this anchor, matching TanStack Table's range-selection semantics.
 */
export const dashboardSelectionAnchorIdAtom = atom<string | null>(null);

/** Clears both the selected IDs and the checkbox range anchor atomically. */
export const clearDashboardSelectionAtom = atom(null, (_get, set) => {
  set(dashboardSelectedDomainIdsAtom, new Set());
  set(dashboardSelectionAnchorIdAtom, null);
});
