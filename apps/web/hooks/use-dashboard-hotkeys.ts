import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys";

import { useDashboardSelection } from "@/hooks/use-dashboard-selection";

export const DASHBOARD_HOTKEYS = {
  selectAll: "Mod+A",
  clearSelection: "Escape",
} as const;

/**
 * Central dashboard command registry. Add future selection-aware commands here
 * and route them through the same actions used by the visible controls.
 */
export function useDashboardHotkeys(): void {
  const { selectedCount, visibleCount, selectAll, clearSelection } = useDashboardSelection();

  const hotkeys: UseHotkeyDefinition[] = [
    {
      hotkey: DASHBOARD_HOTKEYS.selectAll,
      callback: selectAll,
      options: {
        enabled: visibleCount > 0,
        ignoreInputs: true,
        requireReset: true,
        meta: {
          name: "Select all domains",
          description: "Select every domain in the current dashboard results",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.clearSelection,
      callback: (event) => {
        // Escape inside an open popup (dialog, menu, or a combobox whose input keeps
        // focus) dismisses that popup; the selection stays.
        if (
          event.target instanceof Element &&
          event.target.closest(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-expanded="true"]',
          )
        ) {
          return;
        }
        clearSelection();
      },
      options: {
        enabled: selectedCount > 0,
        preventDefault: false,
        stopPropagation: false,
        requireReset: true,
        meta: {
          name: "Clear domain selection",
          description: "Clear the current dashboard selection",
          group: "Dashboard",
        },
      },
    },
  ];

  useHotkeys(hotkeys);
}
