import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { useChatStore } from "@/lib/stores/chat-store";

interface UseChatPersistenceOptions {
  messages: UIMessage[];
  status: ChatStatus;
}

/**
 * Persists cloud chat messages to the Zustand store and clears the runId
 * when a stream finishes or errors (backup for onChatEnd).
 *
 * Initial restore is done by seeding `useChat({ messages })` after hydration.
 */
export function useChatPersistence({ messages, status }: UseChatPersistenceOptions): void {
  const runId = useChatStore((s) => s.runId);
  const setRunId = useChatStore((s) => s.setRunId);
  const storeSetMessages = useChatStore((s) => s.setMessages);

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

    if (wasStreaming && (status === "ready" || status === "error") && runId) {
      setRunId(null);
    }
  }, [status, runId, setRunId]);
}
