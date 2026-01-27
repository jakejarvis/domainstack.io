"use client";

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderSearchState {
  isSearchFocused: boolean;
}

interface HeaderSearchActions {
  setIsSearchFocused: (focused: boolean) => void;
}

type HeaderSearchStore = HeaderSearchState & HeaderSearchActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Header search focus store.
 *
 * Tracks search input focus state for header UI coordination.
 * No persistence needed - this is purely UI state.
 *
 * Usage:
 * ```tsx
 * const isSearchFocused = useHeaderSearchStore((s) => s.isSearchFocused);
 * const setIsSearchFocused = useHeaderSearchStore((s) => s.setIsSearchFocused);
 * ```
 */
export const useHeaderSearchStore = create<HeaderSearchStore>()((set) => ({
  isSearchFocused: false,
  setIsSearchFocused: (isSearchFocused) => set({ isSearchFocused }),
}));
