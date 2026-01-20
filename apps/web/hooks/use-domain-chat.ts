"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import type { UIMessage } from "ai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "@/lib/analytics/client";

const STORAGE_KEY_RUN_ID = "chat-run-id";
const STORAGE_KEY_MESSAGES = "chat-messages";

function getStoredRunId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(STORAGE_KEY_RUN_ID) ?? undefined;
}

function getStoredMessages(): UIMessage[] | undefined {
  if (typeof window === "undefined") return undefined;
  const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
  if (!stored) return undefined;
  try {
    return JSON.parse(stored) as UIMessage[];
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    analytics.trackException(error, { context: "chat-storage-parse" });
    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    return undefined;
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_RUN_ID);
  localStorage.removeItem(STORAGE_KEY_MESSAGES);
}

/**
 * Chat hook with global message history.
 *
 * The current domain (from URL params) is passed as context to the AI,
 * but the conversation history is shared across all pages.
 *
 * Uses WorkflowChatTransport for:
 * - Automatic reconnection after network issues or timeouts
 * - Resumable streaming from the last chunk received
 * - Session persistence via localStorage
 */
export function useDomainChat() {
  const params = useParams<{ domain?: string }>();

  // Decode domain from URL (it may be URL-encoded)
  const domain = params.domain ? decodeURIComponent(params.domain) : undefined;

  // Track submission errors separately for better UX
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get stored run ID for stream resumption (computed once on mount)
  const activeRunId = useMemo(() => getStoredRunId(), []);

  // Configure workflow transport with domain in body and persistence callbacks
  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, domain },
        }),
        onChatSendMessage: (response, options) => {
          // Store messages for restoration on page reload
          localStorage.setItem(
            STORAGE_KEY_MESSAGES,
            JSON.stringify(options.messages),
          );

          // Store the workflow run ID for stream resumption
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            localStorage.setItem(STORAGE_KEY_RUN_ID, workflowRunId);
          }
        },
        onChatEnd: () => {
          // Clear the active run ID when chat completes (but keep messages)
          localStorage.removeItem(STORAGE_KEY_RUN_ID);
        },
      }),
    [domain],
  );

  const chat = useChat({
    transport,
    resume: !!activeRunId,
    onError: (error) => {
      analytics.trackException(error, { context: "chat-send", domain });
      const message = getUserFriendlyError(error);
      setSubmitError(message);
    },
  });

  // Keep setMessages ref up to date to avoid chat object in deps
  const setMessagesRef = useRef(chat.setMessages);
  setMessagesRef.current = chat.setMessages;

  // Restore messages from localStorage once on mount
  const hasRestored = useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const storedMessages = getStoredMessages();
    if (storedMessages && storedMessages.length > 0) {
      setMessagesRef.current(storedMessages);
    }
  }, []);

  // Clear error when user starts typing or retries
  const clearError = useCallback(() => {
    setSubmitError(null);
  }, []);

  // Clear all messages and storage
  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    setSubmitError(null);
    clearStorage();
  }, [chat]);

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
