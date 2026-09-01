"use client";

import type { UIMessage } from "ai";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { MAX_CONVERSATION_MESSAGES } from "@domainstack/constants";

interface ChatState {
  /** Live workflow run ID; persisted so a reload can resume an in-flight stream. */
  runId: string | null;
  messages: UIMessage[];
  /** Groups turns of one conversation for AI observability; reset on clearSession. */
  sessionId: string | null;
}

interface ChatActions {
  setRunId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearSession: () => void;
  /** Returns the current session ID, minting one on first use. */
  ensureSessionId: () => string;
}

type ChatStore = ChatState & ChatActions;

/**
 * Chat store for session persistence (messages and in-flight stream resume).
 */
const chatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      runId: null,
      messages: [],
      sessionId: null,

      setRunId: (runId) => set({ runId }),
      setMessages: (messages) => set({ messages }),
      clearSession: () => set({ runId: null, messages: [], sessionId: null }),
      ensureSessionId: () => {
        const existing = get().sessionId;
        if (existing) return existing;
        const sessionId = crypto.randomUUID();
        set({ sessionId });
        return sessionId;
      },
    }),
    {
      name: "chat",
      version: 2,
      partialize: (state) => ({
        runId: state.runId,
        messages: state.messages.slice(-MAX_CONVERSATION_MESSAGES),
        sessionId: state.sessionId,
      }),
      migrate: (persisted) => {
        const state = persisted as Partial<ChatState>;
        return {
          runId: null,
          messages: state.messages ?? [],
          sessionId: state.sessionId ?? null,
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
