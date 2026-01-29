import type { ChatRequestOptions, UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/stores/chat-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface UseChatPersistenceOptions {
  /** Current messages from useChat */
  messages: UIMessage[];
  /** Current status from useChat */
  status: ChatStatus;
  /** Function to set messages in useChat (for restoration) */
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages chat message persistence between the useChat hook and Zustand store.
 *
 * Handles:
 * - Restoring messages from store on mount (once)
 * - Persisting messages to store when they change
 * - Clearing runId when chat transitions from streaming to ready
 *
 * Uses refs internally to avoid effect dependency issues with callbacks.
 */
export function useChatPersistence({
  messages,
  status,
  setMessages,
}: UseChatPersistenceOptions): void {
  // Store access
  const runId = useChatStore((s) => s.runId);
  const storedMessages = useChatStore((s) => s.messages);
  const setRunId = useChatStore((s) => s.setRunId);
  const storeSetMessages = useChatStore((s) => s.setMessages);

  // Ref to access setMessages without it being a dependency
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  // ---------------------------------------------------------------------------
  // Restore messages from store once on mount
  // ---------------------------------------------------------------------------

  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    if (storedMessages.length > 0) {
      setMessagesRef.current(storedMessages);
    }
  }, [storedMessages]);

  // ---------------------------------------------------------------------------
  // Persist messages to store
  // ---------------------------------------------------------------------------

  const isInitialized = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: using .length + status to balance write frequency with capturing final streamed content
  useEffect(() => {
    if (!isInitialized.current) {
      if (messages.length > 0) {
        isInitialized.current = true;
      }
      return;
    }
    if (messages.length > 0) {
      storeSetMessages(messages);
    }
  }, [messages.length, status, storeSetMessages]);

  // ---------------------------------------------------------------------------
  // Clear runId when chat completes successfully
  // ---------------------------------------------------------------------------

  // The WorkflowChatTransport's onChatEnd callback should clear runId when a finish chunk
  // is received, but sometimes the finish chunk is not received (e.g., during tool execution
  // when the workflow suspends). This effect handles that case by detecting when the chat
  // transitions from streaming to ready with assistant messages, indicating completion.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasStreaming = prevStatusRef.current === "streaming";
    const isNowReady = status === "ready";
    const hasAssistantMessage = messages.some((m) => m.role === "assistant");

    if (wasStreaming && isNowReady && hasAssistantMessage && runId) {
      // Chat completed but onChatEnd wasn't called - clear runId to prevent stale reconnection attempts
      setRunId(null);
    }

    prevStatusRef.current = status;
  }, [status, messages, runId, setRunId]);
}
