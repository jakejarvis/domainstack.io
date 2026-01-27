"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "@/lib/analytics/client";
import { useChatStore } from "@/lib/stores/chat-store";

/**
 * Chat hook with global message history.
 *
 * The current domain (from URL params) is passed as context to the AI,
 * but the conversation history is shared across all pages.
 *
 * Uses WorkflowChatTransport for:
 * - Automatic reconnection after network issues or timeouts
 * - Resumable streaming from the last chunk received
 * - Session persistence via Zustand store
 */
export function useStacky() {
  const params = useParams<{ domain?: string }>();

  // Decode domain from URL (it may be URL-encoded)
  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;

  // Keep domain in a ref so prepareSendMessagesRequest always reads the latest value.
  // useChat doesn't properly react to transport prop changes, so we create the
  // transport once and use a ref to always get the current domain.
  const domainRef = useRef(domain);
  domainRef.current = domain;

  // Track submission errors separately for better UX
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get store state and actions
  const runId = useChatStore((s) => s.runId);
  const storedMessages = useChatStore((s) => s.messages);
  const setRunId = useChatStore((s) => s.setRunId);
  const setMessages = useChatStore((s) => s.setMessages);
  const clearSession = useChatStore((s) => s.clearSession);

  // Configure workflow transport with domain in body and persistence callbacks.
  // Created once - uses domainRef to always get the current domain value.
  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, domain: domainRef.current },
        }),
        onChatSendMessage: (response, options) => {
          // Store messages for restoration on page reload
          setMessages(options.messages);

          // Store the workflow run ID for stream resumption
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            setRunId(workflowRunId);
          }
        },
        onChatEnd: () => {
          // Clear the active run ID when chat completes (but keep messages)
          setRunId(null);
        },
      }),
    [setMessages, setRunId],
  );

  const chat = useChat({
    transport,
    resume: !!runId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
      const message = getUserFriendlyError(error);
      setSubmitError(message);
    },
  });

  // Keep setMessages ref up to date to avoid chat object in deps
  const setChatMessagesRef = useRef(chat.setMessages);
  setChatMessagesRef.current = chat.setMessages;

  // Restore messages from store once on mount
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    if (storedMessages.length > 0) {
      setChatMessagesRef.current(storedMessages);
    }
  }, [storedMessages]);

  // Persist messages to store when:
  // - Message count changes (new message added)
  // - Status changes to 'ready' (streaming completed, final content available)
  // Skip the initial empty state and restoration
  const isInitialized = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: using .length + status to balance write frequency with capturing final streamed content
  useEffect(() => {
    // Skip first render (empty messages)
    if (!isInitialized.current) {
      if (chat.messages.length > 0) {
        isInitialized.current = true;
      }
      return;
    }

    // Save messages to store
    if (chat.messages.length > 0) {
      setMessages(chat.messages);
    }
  }, [chat.messages.length, chat.status, setMessages]);

  // Clear error when user starts typing or retries
  const clearError = useCallback(() => {
    setSubmitError(null);
  }, []);

  // Clear all messages and storage
  const clearMessages = useCallback(() => {
    setChatMessagesRef.current([]);
    setSubmitError(null);
    clearSession();
  }, [clearSession]);

  // Wrap sendMessage to validate and clear errors
  const sendMessage = useCallback(
    (params: { text: string }) => {
      const text = params.text.trim();
      if (!text) {
        setSubmitError("Please enter a message.");
        return;
      }
      clearError();
      chat.sendMessage({ text });
    },
    [chat, clearError],
  );

  // Combine SDK error with our submit error
  const error =
    submitError ?? (chat.error ? getUserFriendlyError(chat.error) : null);

  return {
    ...chat,
    sendMessage,
    domain,
    error,
    clearError,
    clearMessages,
  };
}

/**
 * Convert error to user-friendly message.
 */
function getUserFriendlyError(error: Error): string {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes("fetch") || message.includes("network")) {
    return "Unable to connect. Please check your internet connection.";
  }

  // Rate limiting
  if (message.includes("429") || message.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Server errors
  if (message.includes("500") || message.includes("internal server")) {
    return "Something went wrong on our end. Please try again.";
  }

  // Workflow not found (usually means workflow SDK not configured)
  if (message.includes("workflow") || message.includes("run id")) {
    return "Chat service is not available. Please try again later.";
  }

  // Default fallback
  return "Something went wrong. Please try again.";
}
