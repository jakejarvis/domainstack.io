"use client";

import { atom } from "jotai";

/**
 * Domain pending navigation from suggestion click.
 * Set by HomeSearchSuggestionsClient, consumed by SearchClient.
 */
export const pendingDomainAtom = atom<string | null>(null);

/**
 * Tracks search input focus state for header UI coordination.
 * Set by HeaderSearchClient, consumed by AppHeader variants.
 */
export const isSearchFocusedAtom = atom(false);
