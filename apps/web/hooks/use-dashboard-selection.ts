import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo } from "react";

import { useDashboardView, useDashboardVisibleIdsRef } from "@/context/dashboard-context";
import {
  clearDashboardSelectionAtom,
  dashboardSelectionAnchorIdAtom,
  dashboardSelectedDomainIdsAtom,
} from "@/lib/atoms/dashboard-atoms";

const hasDashboardSelectionAtom = atom((get) => get(dashboardSelectedDomainIdsAtom).size > 0);

/**
 * Whether a single domain is selected. Subscribe in the cell/row that renders
 * the checkbox or selection highlight so the table owner does not have to.
 */
export function useIsDomainSelected(id: string): boolean {
  // Per-hook derived atom so unused IDs are GC'd with the row. atomFamily
  // would retain one atom per ID for the lifetime of the module.
  const isSelectedAtom = useMemo(
    () => atom((get) => get(dashboardSelectedDomainIdsAtom).has(id)),
    [id],
  );
  return useAtomValue(isSelectedAtom);
}

/** Whether the dashboard is currently in multi-select mode. */
export function useHasDashboardSelection(): boolean {
  return useAtomValue(hasDashboardSelectionAtom);
}

/**
 * Clear selection without subscribing to the selected-id set. Safe to call
 * from shells that only need the action, not selection state.
 */
export function useClearDashboardSelection(): () => void {
  const clearSelection = useSetAtom(clearDashboardSelectionAtom);

  return useCallback(() => {
    clearSelection();
  }, [clearSelection]);
}

/**
 * Toggle selection without subscribing to the selected-id set. Safe to call
 * from memoized table cells; does not re-render the component on other
 * selection changes.
 */
export function useToggleDomainSelection(): (id: string) => void {
  const setSelectedIds = useSetAtom(dashboardSelectedDomainIdsAtom);

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

type CheckboxChangeDetails = {
  event: Event;
};

/**
 * Checkbox selection handler shared by grid cards and table rows. Ordinary
 * interactions establish an anchor; Shift applies the endpoint's checked
 * state to the inclusive range in the current dashboard display order.
 */
export function useDomainSelectionHandler(
  id: string,
): (checked: boolean, details: CheckboxChangeDetails) => void {
  const store = useStore();
  const setSelectedIds = useSetAtom(dashboardSelectedDomainIdsAtom);
  const setAnchorId = useSetAtom(dashboardSelectionAnchorIdAtom);
  const visibleIdsRef = useDashboardVisibleIdsRef();

  return useCallback(
    (checked: boolean, details: CheckboxChangeDetails) => {
      const visibleDomainIds = visibleIdsRef.current;
      const anchorId = store.get(dashboardSelectionAnchorIdAtom);
      const anchorIndex = anchorId === null ? -1 : visibleDomainIds.indexOf(anchorId);
      const endpointIndex = visibleDomainIds.indexOf(id);
      const isRangeSelection =
        Boolean((details.event as Event & { shiftKey?: boolean }).shiftKey) &&
        anchorIndex >= 0 &&
        endpointIndex >= 0;

      setSelectedIds((previous) => {
        const next = new Set(previous);
        const ids = isRangeSelection
          ? visibleDomainIds.slice(
              Math.min(anchorIndex, endpointIndex),
              Math.max(anchorIndex, endpointIndex) + 1,
            )
          : [id];

        for (const selectedId of ids) {
          if (checked) next.add(selectedId);
          else next.delete(selectedId);
        }
        return next;
      });
      setAnchorId(id);
    },
    [id, setAnchorId, setSelectedIds, store, visibleIdsRef],
  );
}

/**
 * Selection state and actions scoped to the domains that are currently visible.
 */
export function useDashboardSelection() {
  const [rawSelectedIds, setSelectedIds] = useAtom(dashboardSelectedDomainIdsAtom);
  const { visibleDomainIds } = useDashboardView();
  const clearSelection = useClearDashboardSelection();

  const selectedIds = useMemo(
    () => new Set(visibleDomainIds.filter((id) => rawSelectedIds.has(id))),
    [visibleDomainIds, rawSelectedIds],
  );
  const selectedCount = selectedIds.size;
  const isAllSelected = visibleDomainIds.length > 0 && selectedCount === visibleDomainIds.length;

  const resetAnchor = useSetAtom(dashboardSelectionAnchorIdAtom);

  const selectAll = useCallback(() => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleDomainIds) next.add(id);
      return next;
    });
    resetAnchor(null);
  }, [resetAnchor, setSelectedIds, visibleDomainIds]);

  const toggleAll = useCallback(() => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of visibleDomainIds) {
        if (isAllSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    resetAnchor(null);
  }, [isAllSelected, resetAnchor, setSelectedIds, visibleDomainIds]);

  return {
    selectedIds,
    selectedCount,
    isAllSelected,
    isPartiallySelected: selectedCount > 0 && !isAllSelected,
    visibleCount: visibleDomainIds.length,
    /** Idempotently selects every visible domain. */
    selectAll,
    /** Selects every visible domain, or deselects them if they already are. */
    toggleAll,
    clearSelection,
  };
}
