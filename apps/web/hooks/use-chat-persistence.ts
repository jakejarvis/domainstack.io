import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { useChatHydrated, useChatStore } from "@/lib/stores/chat-store";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface UseChatPersistenceOptions {
  messages: UIMessage[];
  status: ChatStatus;
  setMessages: (messages: UIMessage[]) => void;
}

/**
 * Restores cloud chat messages from the Zustand store after hydration,
 * persists subsequent changes, and clears the in-memory runId when a
 * stream finishes (backup for onChatEnd).
 */
export function useChatPersistence({
  messages,
  status,
  setMessages,
}: UseChatPersistenceOptions): void {
  const hydrated = useChatHydrated();
  const runId = useChatStore((s) => s.runId);
  const storedMessages = useChatStore((s) => s.messages);
  const setRunId = useChatStore((s) => s.setRunId);
  const storeSetMessages = useChatStore((s) => s.setMessages);

  const setMessagesRef = useRef(setMessages);
  useEffect(() => {
    setMessagesRef.current = setMessages;
  });

  const hasRestored = useRef(false);
  useEffect(() => {
    if (!hydrated || hasRestored.current) return;
    hasRestored.current = true;
    if (storedMessages.length > 0) {
      setMessagesRef.current(storedMessages);
    }
  }, [hydrated, storedMessages]);

  const isInitialized = useRef(false);
  useEffect(() => {
    if (!isInitialized.current) {
      if (messages.length > 0) {
        isInitialized.current = true;
        // Transport can fail before onChatSendMessage writes the store.
        if (status === "error") {
          storeSetMessages(messages);
        }
      }
      return;
    }
    if (messages.length > 0) {
      storeSetMessages(messages);
    }
  }, [messages, status, storeSetMessages]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming";
    prevStatusRef.current = status;

    if (wasStreaming && status === "ready" && runId) {
      setRunId(null);
    }
  }, [status, runId, setRunId]);
}
