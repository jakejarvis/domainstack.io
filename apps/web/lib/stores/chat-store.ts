"use client";

import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatState {
  // Session state (persisted)
  runId: string | null;
  messages: UIMessage[];
}

interface ChatActions {
  setRunId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearSession: () => void;
}

type ChatStore = ChatState & ChatActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Chat store for session persistence (runId, messages).
 * UI state (open/settings dialogs) is local useState in ChatTriggerClient.
 *
 * Usage:
 * ```tsx
 * const messages = useChatStore((s) => s.messages);
 * const setMessages = useChatStore((s) => s.setMessages);
 * ```
 */
const chatStore = create<ChatStore>()(
  persist(
    (set) => ({
      runId: null,
      messages: [],

      setRunId: (runId) => set({ runId }),
      setMessages: (messages) => set({ messages }),
      clearSession: () => set({ runId: null, messages: [] }),
    }),
    {
      name: "chat",
      version: 1,
      partialize: (state) => ({
        runId: state.runId,
        messages: state.messages,
      }),
    },
  ),
);

export const useChatStore = chatStore;

const subscribeChatHydration = chatStore.persist.onFinishHydration;
const getChatHydrationSnapshot = () => chatStore.persist.hasHydrated();
const getChatHydrationServerSnapshot = () => false;

/**
 * Returns true once the chat store has hydrated from localStorage.
 * Use this to prevent restoring messages before the store has loaded persisted data.
 *
 * @see https://zustand.docs.pmnd.rs/integrations/persisting-store-data#how-can-i-check-if-my-store-has-been-hydrated
 */
export const useChatHydrated = () =>
  useSyncExternalStore(
    subscribeChatHydration,
    getChatHydrationSnapshot,
    getChatHydrationServerSnapshot,
  );
