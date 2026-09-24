"use client";

import { atom } from "jotai";

/**
 * Domain a home suggestion chip asked the home search to look up. Set by
 * HomeSearchSuggestionsClient on a plain click; SearchClient consumes it right
 * away and navigates through its own transition, so its spinner follows the
 * navigation instead of this atom.
 */
export const pendingDomainAtom = atom<string | null>(null);
