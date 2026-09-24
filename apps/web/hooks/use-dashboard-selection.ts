import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";

import { useDashboardView } from "@/context/dashboard-context";
import { selectedDomainIdsAtom } from "@/lib/atoms/dashboard-atoms";

/**
 * Whether a single domain is selected. Subscribe in the cell/row that renders
 * the checkbox or selection highlight so the table owner does not have to.
 */
export function useIsDomainSelected(id: string): boolean {
  // Per-hook derived atom so unused IDs are GC'd with the row. atomFamily
  // would retain one atom per ID for the lifetime of the module.
  const isSelectedAtom = useMemo(() => atom((get) => get(selectedDomainIdsAtom).has(id)), [id]);
  return useAtomValue(isSelectedAtom);
}

/**
 * Clear selection without subscribing to the selected-id set. Safe to call
 * from shells that only need the action, not selection state.
 */
export function useClearDashboardSelection(): () => void {
  const setSelectedIds = useSetAtom(selectedDomainIdsAtom);

  return useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);
}

/**
 * Toggle selection without subscribing to the selected-id set. Safe to call
 * from memoized table cells; does not re-render the component on other
 * selection changes.
 */
export function useToggleDomainSelection(): (id: string) => void {
  const setSelectedIds = useSetAtom(selectedDomainIdsAtom);

  return useCallback(
    (id: string) => {
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [setSelectedIds],
  );
}

/**
 * Selection state for the bulk actions toolbar, scoped to the domains that are
 * currently visible. Escape clears the selection.
 */
export function useDashboardSelection() {
  const [rawSelectedIds, setSelectedIds] = useAtom(selectedDomainIdsAtom);
  const { visibleDomains } = useDashboardView();
  const clearSelection = useClearDashboardSelection();

  const visibleIds = useMemo(() => visibleDomains.map((d) => d.id), [visibleDomains]);
  const selectedIds = useMemo(
    () => new Set(visibleIds.filter((id) => rawSelectedIds.has(id))),
    [visibleIds, rawSelectedIds],
  );
  const selectedCount = selectedIds.size;
  const isAllSelected = visibleIds.length > 0 && selectedCount === visibleIds.length;

  useEffect(() => {
    if (selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedCount, clearSelection]);

  return {
    selectedIds,
    selectedCount,
    isAllSelected,
    isPartiallySelected: selectedCount > 0 && !isAllSelected,
    /** Selects every visible domain, or clears the selection if they already are. */
    toggleAll: () => setSelectedIds(isAllSelected ? new Set() : new Set(visibleIds)),
    clearSelection,
  };
}
