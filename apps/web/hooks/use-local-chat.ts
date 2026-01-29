"use client";

import type { browserAI } from "@browser-ai/core";
import {
  convertToModelMessages,
  generateId,
  readUIMessageStream,
  stepCountIs,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chat status matching the useChat hook from @ai-sdk/react.
 */
export type LocalChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface UseLocalChatOptions {
  /** Browser AI model instance from useBrowserAI (null when not ready) */
  model: ReturnType<typeof browserAI> | null;
  /** Tools for the model to use (from createClientDomainTools) */
  tools: ToolSet;
  /** System prompt for the chat */
  systemPrompt: string;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseLocalChatReturn {
  /** Current messages in the conversation */
  messages: UIMessage[];
  /** Current chat status */
  status: LocalChatStatus;
  /** Current error if status is "error" */
  error: Error | null;
  /** Send a message to the chat */
  sendMessage: (params: { text: string }) => void;
  /** Set messages directly (for persistence restore) */
  setMessages: (messages: UIMessage[]) => void;
}

/**
 * Hook to run AI chat locally in the browser with tool calling support.
 *
 * This hook provides the same interface as the useChat hook from @ai-sdk/react,
 * but runs the AI model directly in the browser using the browserAI provider.
 * Tool calls are executed client-side, calling tRPC procedures on the server.
 *
 * @example
 * ```tsx
 * const { model } = useBrowserAI();
 * const trpc = useTRPCClient();
 * const tools = useMemo(() => createClientDomainTools(trpc), [trpc]);
 *
 * const { messages, status, sendMessage } = useLocalChat({
 *   model,
 *   tools,
 *   systemPrompt: "You are a helpful domain assistant...",
 * });
 * ```
 */
export function useLocalChat({
  model,
  tools,
  systemPrompt,
  onError,
}: UseLocalChatOptions): UseLocalChatReturn {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<LocalChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently processing to prevent double-sends
  const processingRef = useRef(false);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: abort any in-flight request on unmount to prevent state updates
  // on unmounted component and avoid memory leaks
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const sendMessage = useCallback(
    async (params: { text: string }) => {
      const text = params.text.trim();
      // Guard: don't send if no text, already processing, or model not ready
      if (!text || processingRef.current || !model) return;

      processingRef.current = true;
      setStatus("submitted");
      setError(null);

      // Cancel any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessage: UIMessage = {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text }],
      };

      // Add placeholder assistant message for streaming
      const assistantMessageId = generateId();
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [],
      };

      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, assistantMessage]);

      try {
        setStatus("streaming");

        // Convert to model messages using AI SDK's converter
        const modelMessages = await convertToModelMessages(updatedMessages);

        // Run the model with tool calling
        // stopWhen: stepCountIs(5) enables multi-step tool execution - without it,
        // the model stops after generating a tool call without executing it
        const result = streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(3),
          abortSignal: abortControllerRef.current.signal,
        });

        // Stream the response using readUIMessageStream to capture all parts
        // (text, tool-call, tool-result) - textStream only emits text deltas
        for await (const uiMessage of readUIMessageStream({
          stream: result.toUIMessageStream(),
        })) {
          // Update the assistant message with all accumulated parts
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    parts: uiMessage.parts,
                  }
                : msg,
            ),
          );
        }

        setStatus("ready");
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("ready");
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        setStatus("error");
        onError?.(error);

        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId),
        );
      } finally {
        processingRef.current = false;
      }
    },
    [model, tools, systemPrompt, messages, onError],
  );

  return {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
  };
}
