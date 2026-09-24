"use client";

import { atom } from "jotai";

/**
 * Domain a home suggestion chip is navigating to. The chip's own link does the
 * navigation; the home search shows this domain and its spinner meanwhile, and
 * clears it once the home page is hidden or unmounted.
 */
export const pendingDomainAtom = atom<string | null>(null);
