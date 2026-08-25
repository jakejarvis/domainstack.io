"use client";

import { atom } from "jotai";

/**
 * Whether the chat panel is open.
 * Global so any component can programmatically open the chat.
 */
export const chatOpenAtom = atom(false);
