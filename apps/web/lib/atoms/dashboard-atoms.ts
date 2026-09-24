import { atom } from "jotai";

/**
 * Selected domain IDs for dashboard multi-select. May hold IDs that are no
 * longer visible (e.g. archived from another tab); `useDashboardSelection`
 * intersects with the visible domains before reporting or acting on them.
 */
export const selectedDomainIdsAtom = atom<Set<string>>(new Set<string>());
