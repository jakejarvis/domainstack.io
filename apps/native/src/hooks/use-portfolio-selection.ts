import { useShallow } from "zustand/shallow";

import { usePortfolioStore } from "@/lib/stores/portfolio-store";

export function useSelectionMode() {
  return usePortfolioStore((state) => state.selection.mode);
}

export function useSelectionCount() {
  return usePortfolioStore((state) => state.selection.ids.size);
}

export function useIsSelected(id: string) {
  return usePortfolioStore((state) => state.selection.ids.has(id));
}

export function useSelectionActions() {
  return usePortfolioStore(
    useShallow((state) => ({
      clear: state.clear,
      enterSelection: state.enterSelection,
      exitSelection: state.exitSelection,
      selectAll: state.selectAll,
      toggle: state.toggle,
    })),
  );
}

export function getSelectedIds(): string[] {
  return Array.from(usePortfolioStore.getState().selection.ids);
}
