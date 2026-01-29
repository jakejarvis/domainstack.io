import { atom } from "jotai";

// ---------------------------------------------------------------------------
// Selection Atoms
// ---------------------------------------------------------------------------

/**
 * Core selection state - set of selected domain IDs.
 * This is the source of truth for multi-select in the dashboard.
 */
export const selectedDomainIdsAtom = atom<Set<string>>(new Set<string>());

/**
 * Visible domain IDs after filtering.
 * Set by the parent component when filters change.
 * Used for "select all" and "is all selected" logic.
 */
export const visibleDomainIdsAtom = atom<string[]>([]);

// ---------------------------------------------------------------------------
// Derived Selection Atoms
// ---------------------------------------------------------------------------

/** Number of selected domains */
export const selectedCountAtom = atom((get) => get(selectedDomainIdsAtom).size);

/** Whether any domains are selected */
export const hasSelectionAtom = atom(
  (get) => get(selectedDomainIdsAtom).size > 0,
);

/** Whether all visible domains are selected */
export const isAllSelectedAtom = atom((get) => {
  const selected = get(selectedDomainIdsAtom);
  const visible = get(visibleDomainIdsAtom);
  return visible.length > 0 && visible.every((id) => selected.has(id));
});

/** Whether some (but not all) visible domains are selected */
export const isPartiallySelectedAtom = atom((get) => {
  const selected = get(selectedDomainIdsAtom);
  const visible = get(visibleDomainIdsAtom);
  const visibleSelectedCount = visible.filter((id) => selected.has(id)).length;
  return visibleSelectedCount > 0 && visibleSelectedCount < visible.length;
});
