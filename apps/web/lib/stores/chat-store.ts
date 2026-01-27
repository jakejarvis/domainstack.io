"use client";

import type { UIMessage } from "ai";
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
export const useChatStore = create<ChatStore>()(
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
