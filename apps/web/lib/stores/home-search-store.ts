"use client";

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HomeSearchState {
  /** Domain pending navigation from suggestion click */
  pendingDomain: string | null;
}

interface HomeSearchActions {
  setPendingDomain: (domain: string | null) => void;
}

type HomeSearchStore = HomeSearchState & HomeSearchActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Home search store for coordinating suggestion clicks with navigation.
 *
 * When a suggestion is clicked on the homepage, `pendingDomain` is set.
 * The SearchClient reads this and triggers navigation, then clears it.
 *
 * Usage:
 * ```tsx
 * const pendingDomain = useHomeSearchStore((s) => s.pendingDomain);
 * const setPendingDomain = useHomeSearchStore((s) => s.setPendingDomain);
 * ```
 */
export const useHomeSearchStore = create<HomeSearchStore>()((set) => ({
  pendingDomain: null,
  setPendingDomain: (pendingDomain) => set({ pendingDomain }),
}));
