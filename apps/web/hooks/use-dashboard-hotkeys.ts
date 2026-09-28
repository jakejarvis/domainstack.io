import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys";

import { useDashboardBulkActions, useDashboardView } from "@/context/dashboard-context";
import { useDashboardSelection } from "@/hooks/use-dashboard-selection";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useDashboardViewMode, usePreferencesStore } from "@/lib/stores/preferences-store";

export const DASHBOARD_HOTKEYS = {
  selectAll: "Mod+A",
  clearSelection: "Escape",
  archive: "E",
  toggleMute: "M",
  delete: "#",
  focusSearch: "/",
  toggleView: "V",
  addDomain: "N",
} as const;

/**
 * Whether a key event came from inside an open popup (dialog, menu, or a
 * combobox whose input keeps focus). Keys there belong to the popup, so
 * dashboard commands stand down.
 */
function isFromOpenPopup(event: KeyboardEvent): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-expanded="true"]',
    ) !== null
  );
}

/**
 * Central dashboard command registry. Add future selection-aware commands here
 * and route them through the same actions used by the visible controls.
 */
export function useDashboardHotkeys(): void {
  const { selectedIds, selectedCount, visibleCount, selectAll, clearSelection } =
    useDashboardSelection();
  const { visibleDomains } = useDashboardView();
  const { onBulkArchive, onBulkDelete, onBulkMute, isBulkArchiving, isBulkDeleting, isBulkMuting } =
    useDashboardBulkActions();
  const viewMode = useDashboardViewMode();
  const setViewMode = usePreferencesStore((s) => s.setViewMode);
  const { subscription } = useSubscription();
  const router = useRouter();

  const canRunBulkAction =
    selectedCount > 0 && !isBulkArchiving && !isBulkDeleting && !isBulkMuting;

  // Single-key commands already skip text inputs (TanStack's default); they
  // also skip open popups so typing or dismissing there never triggers them.
  const unlessInPopup =
    (command: () => void) =>
    (event: KeyboardEvent): void => {
      if (!isFromOpenPopup(event)) command();
    };

  const hotkeys: UseHotkeyDefinition[] = [
    {
      hotkey: DASHBOARD_HOTKEYS.selectAll,
      // In a popup, leave Mod+A to the browser; only block its select-all when we handle it.
      callback: (event) => {
        if (isFromOpenPopup(event)) return;
        event.preventDefault();
        selectAll();
      },
      options: {
        enabled: visibleCount > 0,
        ignoreInputs: true,
        preventDefault: false,
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
      // Escape inside a popup dismisses that popup, and mid-composition it
      // cancels the IME; either way the selection stays.
      callback: (event) => {
        if (event.isComposing) return;
        unlessInPopup(clearSelection)(event);
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
    {
      hotkey: DASHBOARD_HOTKEYS.archive,
      callback: unlessInPopup(() => onBulkArchive(Array.from(selectedIds))),
      options: {
        enabled: canRunBulkAction,
        requireReset: true,
        meta: {
          name: "Archive selected",
          description: "Archive the selected domains",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.toggleMute,
      callback: unlessInPopup(() => {
        // Mute unless every selected domain is already muted, like a toggle.
        const allMuted = visibleDomains.every((d) => !selectedIds.has(d.id) || d.muted);
        onBulkMute(Array.from(selectedIds), !allMuted);
      }),
      options: {
        enabled: canRunBulkAction,
        requireReset: true,
        meta: {
          name: "Mute or unmute selected",
          description: "Mute the selected domains, or unmute them if all are muted",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.delete,
      callback: unlessInPopup(() => onBulkDelete(Array.from(selectedIds))),
      options: {
        enabled: canRunBulkAction,
        requireReset: true,
        meta: {
          name: "Delete selected",
          description: "Delete the selected domains, after confirmation",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.focusSearch,
      callback: unlessInPopup(() => {
        // The filters render twice (desktop row and mobile collapsible); focus the visible one.
        const inputs = document.querySelectorAll<HTMLInputElement>('input[name="domain-search"]');
        Array.from(inputs)
          .find((input) => input.checkVisibility())
          ?.focus();
      }),
      // preventDefault (the default) keeps the "/" out of the input it just focused.
      options: {
        meta: {
          name: "Filter domains",
          description: "Focus the dashboard search",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.toggleView,
      callback: unlessInPopup(() => setViewMode(viewMode === "grid" ? "table" : "grid")),
      options: {
        requireReset: true,
        meta: {
          name: "Switch view",
          description: "Switch between grid and table",
          group: "Dashboard",
        },
      },
    },
    {
      hotkey: DASHBOARD_HOTKEYS.addDomain,
      callback: unlessInPopup(() => router.push("/dashboard/add-domain", { scroll: false })),
      options: {
        enabled: subscription?.canAddMore === true,
        requireReset: true,
        meta: {
          name: "Add domain",
          description: "Start tracking a new domain",
          group: "Dashboard",
        },
      },
    },
  ];

  useHotkeys(hotkeys);
}
