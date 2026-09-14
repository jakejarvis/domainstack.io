"use client";

import { atom } from "jotai";

/**
 * Domain pending navigation from suggestion click.
 * Set by HomeSearchSuggestionsClient, consumed by SearchClient.
 */
export const pendingDomainAtom = atom<string | null>(null);
