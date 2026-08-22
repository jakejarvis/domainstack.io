"use client";

import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatState {
  /** In-memory only — used to reconnect a live stream, never restored. */
  runId: string | null;
  messages: UIMessage[];
}

interface ChatActions {
  setRunId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearSession: () => void;
}

type ChatStore = ChatState & ChatActions;

/**
 * Chat store for session persistence (messages) and in-memory stream resume (runId).
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
      version: 2,
      partialize: (state) => ({
        messages: state.messages,
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<ChatState>;
        return {
          runId: null,
          messages: state.messages ?? [],
        };
      },
    },
  ),
);

export const useChatStore = chatStore;

const subscribeChatHydration = chatStore.persist.onFinishHydration;
const getChatHydrationSnapshot = () => chatStore.persist.hasHydrated();
const getChatHydrationServerSnapshot = () => false;

/**
 * Returns true once the chat store has hydrated from localStorage.
 */
export const useChatHydrated = () =>
  useSyncExternalStore(
    subscribeChatHydration,
    getChatHydrationSnapshot,
    getChatHydrationServerSnapshot,
  );
