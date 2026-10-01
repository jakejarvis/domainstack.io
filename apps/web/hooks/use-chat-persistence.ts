import type { ChatStatus, UIMessage } from "ai";
import { useEffect, useRef } from "react";

import { useChatStore } from "@/lib/stores/chat-store";

interface UseChatPersistenceOptions {
  messages: UIMessage[];
  status: ChatStatus;
}

/**
 * Persists cloud chat messages to the Zustand store when a turn settles
 * (status "ready" or "error") and clears the runId when a stream finishes or
 * errors (backup for onChatEnd).
 *
 * Messages are deliberately not written mid-stream: onChatSendMessage already
 * stored the outgoing user turn, and persisting a partial assistant reply would
 * make a resume after reload append a second copy of the answer.
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
    if (messages.length > 0 && (status === "ready" || status === "error")) {
      storeSetMessages(messages);
    }
  }, [messages, status, storeSetMessages]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    // "submitted" counts too: aborting before the first chunk goes straight
    // back to "ready" and would otherwise leave a stale runId to resume.
    const wasBusy = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (wasBusy && (status === "ready" || status === "error") && runId) {
      setRunId(null);
    }
  }, [status, runId, setRunId]);
}
