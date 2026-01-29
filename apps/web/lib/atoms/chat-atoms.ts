"use client";

import { atom } from "jotai";

// ---------------------------------------------------------------------------
// Chat UI State
// ---------------------------------------------------------------------------

/**
 * Whether the chat panel is open.
 * Global atom so any component can programmatically open the chat
 * (e.g., "Ask AI about this domain" buttons).
 */
export const chatOpenAtom = atom(false);

// ---------------------------------------------------------------------------
// Chat Context
// ---------------------------------------------------------------------------

/**
 * Context types for the chat assistant.
 * Each context type provides relevant information for generating suggestions
 * and giving the AI appropriate context about what the user is looking at.
 */
export type ChatContext = { type: "home" } | { type: "report"; domain: string };
// TODO: | { type: "dashboard"; trackedDomains: string[]; filters?: string }

/**
 * Current chat context atom.
 * Set by page components to inform the chat about what's relevant.
 *
 * Usage:
 * ```tsx
 * // In report page
 * const setContext = useSetAtom(chatContextAtom);
 * useEffect(() => {
 *   setContext({ type: "report", domain: "example.com" });
 *   return () => setContext({ type: "home" });
 * }, [domain]);
 * ```
 */
export const chatContextAtom = atom<ChatContext>({ type: "home" });

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/**
 * Server-generated suggestions atom.
 * Hydrated by ChatTriggerClient with randomized suggestions from the server.
 * Used as fallback when no context-specific suggestions are available.
 */
export const serverSuggestionsAtom = atom<string[]>([]);

/**
 * Derived atom that computes chat suggestions based on current context.
 * Falls back to server-generated suggestions for "home" context.
 *
 * Usage:
 * ```tsx
 * const suggestions = useAtomValue(chatSuggestionsAtom);
 * ```
 */
export const chatSuggestionsAtom = atom<string[]>((get) => {
  const context = get(chatContextAtom);
  const serverSuggestions = get(serverSuggestionsAtom);

  switch (context.type) {
    case "report":
      return [
        `When does ${context.domain} expire?`,
        `Is ${context.domain} missing any important security headers?`,
        `Which email provider does ${context.domain} use?`,
        `Is ${context.domain}'s SSL certificate valid?`,
      ];
    default:
      return serverSuggestions;
  }
});
