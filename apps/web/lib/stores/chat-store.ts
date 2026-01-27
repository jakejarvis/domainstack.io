"use client";

import type { UIMessage } from "ai";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatState {
  // UI state (not persisted)
  isOpen: boolean;
  isSettingsOpen: boolean;
  // Session state (persisted)
  runId: string | null;
  messages: UIMessage[];
}

interface ChatActions {
  setOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setRunId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearSession: () => void;
}

type ChatStore = ChatState & ChatActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Chat store for UI state and session persistence.
 *
 * Usage:
 * ```tsx
 * const isOpen = useChatStore((s) => s.isOpen);
 * const setOpen = useChatStore((s) => s.setOpen);
 * const messages = useChatStore((s) => s.messages);
 * ```
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      isOpen: false,
      isSettingsOpen: false,
      runId: null,
      messages: [],

      setOpen: (isOpen) => set({ isOpen }),
      setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      setRunId: (runId) => set({ runId }),
      setMessages: (messages) => set({ messages }),
      clearSession: () => set({ runId: null, messages: [] }),
    }),
    {
      name: "chat",
      version: 1,
      // Only persist session data, not UI state
      partialize: (state) => ({
        runId: state.runId,
        messages: state.messages,
      }),
    },
  ),
);
