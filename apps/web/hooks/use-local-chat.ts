"use client";

import type { browserAI } from "@browser-ai/core";
import {
  convertToModelMessages,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";
import { useCallback, useRef, useState } from "react";

/**
 * Chat status matching the useChat hook from @ai-sdk/react.
 */
export type LocalChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface UseLocalChatOptions {
  /** Browser AI model instance from useBrowserAI */
  model: ReturnType<typeof browserAI>;
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

let messageIdCounter = 0;
function generateMessageId(): string {
  return `local-msg-${Date.now()}-${++messageIdCounter}`;
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

  const sendMessage = useCallback(
    async (params: { text: string }) => {
      const text = params.text.trim();
      if (!text || processingRef.current) return;

      processingRef.current = true;
      setStatus("submitted");
      setError(null);

      // Cancel any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessage: UIMessage = {
        id: generateMessageId(),
        role: "user",
        parts: [{ type: "text", text }],
      };

      // Add placeholder assistant message for streaming
      const assistantMessageId = generateMessageId();
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
        // Note: maxSteps is not directly supported by streamText, but the AI SDK
        // will handle multi-step tool calling automatically
        const result = streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          tools,
          abortSignal: abortControllerRef.current.signal,
        });

        let fullText = "";

        // Stream the response
        for await (const chunk of result.textStream) {
          fullText += chunk;

          // Update the assistant message with accumulated text
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    parts: fullText
                      ? [{ type: "text" as const, text: fullText }]
                      : [],
                  }
                : msg,
            ),
          );
        }

        // Get the final text
        const finalText = await result.text;

        // Final update with complete text
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  parts: finalText
                    ? [{ type: "text" as const, text: finalText }]
                    : [],
                }
              : msg,
          ),
        );

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
