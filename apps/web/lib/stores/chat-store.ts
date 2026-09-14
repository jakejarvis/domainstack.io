"use client";

import type { UIMessage } from "ai";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usePersistHydration } from "@/lib/stores/persist-hydration";
import { MAX_CLIENT_CHAT_HISTORY_AGE_MS, MAX_CONVERSATION_MESSAGES } from "@domainstack/constants";

interface ChatState {
  lastMessageAt: number | null;
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

const EMPTY_CHAT_STATE: ChatState = {
  lastMessageAt: null,
  runId: null,
  messages: [],
  sessionId: null,
};

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

function parsePersistedState(value: unknown): ChatState {
  if (!value || typeof value !== "object") {
    return EMPTY_CHAT_STATE;
  }

  const state = value as Partial<ChatState>;
  const messages = parseMessages(state.messages);
  const lastMessageAt = state.lastMessageAt;
  const now = Date.now();
  const isRecent =
    messages.length > 0 &&
    typeof lastMessageAt === "number" &&
    Number.isFinite(lastMessageAt) &&
    lastMessageAt <= now &&
    now - lastMessageAt < MAX_CLIENT_CHAT_HISTORY_AGE_MS;

  if (!isRecent) {
    return EMPTY_CHAT_STATE;
  }

  return {
    lastMessageAt,
    runId: typeof state.runId === "string" ? state.runId : null,
    messages,
    sessionId: typeof state.sessionId === "string" ? state.sessionId : null,
  };
}

const chatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      lastMessageAt: null,
      runId: null,
      messages: [],
      sessionId: null,

      setRunId: (runId) => set({ runId }),
      setMessages: (messages) =>
        set({ lastMessageAt: messages.length > 0 ? Date.now() : null, messages }),
      clearSession: () => set(EMPTY_CHAT_STATE),
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
      version: 3,
      partialize: (state) => ({
        lastMessageAt: state.lastMessageAt,
        runId: state.runId,
        messages: state.messages.slice(-MAX_CONVERSATION_MESSAGES),
        sessionId: state.sessionId,
      }),
      migrate: () => EMPTY_CHAT_STATE,
      merge: (persistedState, currentState) => {
        const persisted = parsePersistedState(persistedState);
        return {
          ...currentState,
          ...persisted,
        };
      },
    },
  ),
);

export const useChatStore = chatStore;

export const useChatHydrated = () => usePersistHydration(chatStore);
