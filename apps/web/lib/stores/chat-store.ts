"use client";

import type { UIMessage } from "ai";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usePersistHydration } from "@/lib/stores/persist-hydration";
import { MAX_CONVERSATION_MESSAGES } from "@domainstack/constants";

interface ChatState {
  runId: string | null;
  messages: UIMessage[];
  sessionId: string | null;
}

interface ChatActions {
  setRunId: (id: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearSession: () => void;
  ensureSessionId: () => string;
}

type ChatStore = ChatState & ChatActions;

function isPersistedMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    Array.isArray(message.parts)
  );
}

function parseMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isPersistedMessage).slice(-MAX_CONVERSATION_MESSAGES);
}

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
          messages: parseMessages(state.messages),
          sessionId: typeof state.sessionId === "string" ? state.sessionId : null,
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ChatState> | null;
        return {
          ...currentState,
          runId: typeof persisted?.runId === "string" ? persisted.runId : currentState.runId,
          messages: Array.isArray(persisted?.messages)
            ? parseMessages(persisted.messages)
            : currentState.messages,
          sessionId:
            typeof persisted?.sessionId === "string" ? persisted.sessionId : currentState.sessionId,
        };
      },
    },
  ),
);

export const useChatStore = chatStore;

export const useChatHydrated = () => usePersistHydration(chatStore);
