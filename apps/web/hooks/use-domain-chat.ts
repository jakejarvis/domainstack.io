"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import type { UIMessage } from "ai";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_PREFIX = "domain-chat";

function getStorageKeys(domain?: string) {
  const suffix = domain ? `-${domain}` : "";
  return {
    runId: `${STORAGE_PREFIX}-run-id${suffix}`,
    messages: `${STORAGE_PREFIX}-messages${suffix}`,
  };
}

function getStoredRunId(domain?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(getStorageKeys(domain).runId) ?? undefined;
}

function getStoredMessages(domain?: string): UIMessage[] | undefined {
  if (typeof window === "undefined") return undefined;
  const stored = localStorage.getItem(getStorageKeys(domain).messages);
  if (!stored) return undefined;
  try {
    return JSON.parse(stored) as UIMessage[];
  } catch {
    return undefined;
  }
}

function clearStorage(domain?: string) {
  if (typeof window === "undefined") return;
  const keys = getStorageKeys(domain);
  localStorage.removeItem(keys.runId);
  localStorage.removeItem(keys.messages);
}

/**
 * Custom hook wrapping useChat with domain context.
 * Automatically extracts domain from URL params on /[domain] pages.
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
  const activeRunId = useMemo(() => getStoredRunId(domain), [domain]);

  // Track whether we've restored messages to avoid doing it multiple times
  const hasRestoredMessages = useRef(false);

  // Configure workflow transport with domain in body and persistence callbacks
  const transport = useMemo(() => {
    const keys = getStorageKeys(domain);

    return new WorkflowChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, domain },
      }),
      onChatSendMessage: (response, options) => {
        // Store messages for restoration on page reload
        localStorage.setItem(keys.messages, JSON.stringify(options.messages));

        // Store the workflow run ID for stream resumption
        const workflowRunId = response.headers.get("x-workflow-run-id");
        if (workflowRunId) {
          localStorage.setItem(keys.runId, workflowRunId);
        }
      },
      onChatEnd: () => {
        // Clear the active run ID when chat completes (but keep messages)
        localStorage.removeItem(keys.runId);
      },
    });
  }, [domain]);

  const chat = useChat({
    transport,
    resume: !!activeRunId,
    onError: (error) => {
      // Extract user-friendly error message
      const message = getUserFriendlyError(error);
      setSubmitError(message);
    },
  });

  // Restore messages from localStorage on mount
  useEffect(() => {
    if (hasRestoredMessages.current) return;
    hasRestoredMessages.current = true;

    const storedMessages = getStoredMessages(domain);
    if (storedMessages && storedMessages.length > 0) {
      chat.setMessages(storedMessages);
    }
  }, [domain, chat]);

  // Clear error when user starts typing or retries
  const clearError = useCallback(() => {
    setSubmitError(null);
  }, []);

  // Clear all messages and storage
  const clearMessages = useCallback(() => {
    chat.setMessages([]);
    setSubmitError(null);
    clearStorage(domain);
  }, [chat, domain]);

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
