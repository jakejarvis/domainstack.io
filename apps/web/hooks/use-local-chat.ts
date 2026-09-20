"use client";

import type { browserAI } from "@browser-ai/core";
import {
  convertToModelMessages,
  generateId,
  isStepCount,
  readUIMessageStream,
  ToolLoopAgent,
  type ToolSet,
  type UIMessage,
} from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHAT_RUN_TIMEOUT_MS,
  CHAT_STALL_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
} from "@domainstack/constants";

/**
 * Chat status matching the useChat hook from @ai-sdk/react.
 */
type LocalChatStatus = "ready" | "submitted" | "streaming" | "error";

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
  /** Retry the last assistant turn without adding a new user message */
  regenerate: () => void;
  /** Clear the error state and return to ready */
  clearError: () => void;
  /** Set messages directly (for persistence restore) */
  setMessages: (messages: UIMessage[]) => void;
  /** Abort the in-flight turn, if any */
  stop: () => void;
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

  const runAssistantTurn = useCallback(
    async (conversation: UIMessage[]) => {
      if (processingRef.current || !model || conversation.at(-1)?.role !== "user") {
        return;
      }

      processingRef.current = true;
      setStatus("submitted");
      setError(null);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      // A stopped turn may settle after a newer one has started.
      const isCurrent = () => abortControllerRef.current === controller;

      const assistantMessageId = generateId();
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [],
      };

      setMessages([...conversation, assistantMessage]);

      try {
        setStatus("streaming");

        const modelMessages = await convertToModelMessages(conversation, {
          tools,
          ignoreIncompleteToolCalls: true,
        });
        const agent = new ToolLoopAgent({
          model,
          instructions: systemPrompt,
          tools,
          stopWhen: isStepCount(MAX_TOOL_STEPS),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });
        const result = await agent.stream({
          messages: modelMessages,
          abortSignal: controller.signal,
          timeout: { totalMs: CHAT_RUN_TIMEOUT_MS, chunkMs: CHAT_STALL_TIMEOUT_MS },
        });

        for await (const uiMessage of readUIMessageStream({
          stream: result.toUIMessageStream(),
        })) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, parts: uiMessage.parts } : msg,
            ),
          );
        }

        if (isCurrent()) setStatus("ready");
      } catch (err) {
        if (!isCurrent()) return;
        // An abort we didn't trigger ourselves came from the SDK's timeout.
        const abortedByUs = controller.signal.aborted;
        if (abortedByUs && err instanceof Error && err.name === "AbortError") {
          setStatus("ready");
          return;
        }

        const nextError =
          err instanceof Error && err.name === "AbortError"
            ? new Error("Local chat timed out")
            : err instanceof Error
              ? err
              : new Error("Unknown error");
        setError(nextError);
        setStatus("error");
        onError?.(nextError);
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      } finally {
        if (isCurrent()) processingRef.current = false;
      }
    },
    [model, tools, systemPrompt, onError],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    processingRef.current = false;
    setStatus((prev) => (prev === "submitted" || prev === "streaming" ? "ready" : prev));
  }, []);

  const sendMessage = useCallback(
    (params: { text: string }) => {
      const text = params.text.trim();
      if (!text || processingRef.current || !model) return;

      const userMessage: UIMessage = {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text }],
      };

      void runAssistantTurn([...messages, userMessage]);
    },
    [messages, model, runAssistantTurn],
  );

  const regenerate = useCallback(() => {
    const last = messages.at(-1);
    const conversation = last?.role === "assistant" ? messages.slice(0, -1) : messages;
    void runAssistantTurn(conversation);
  }, [messages, runAssistantTurn]);

  const clearError = useCallback(() => {
    setError(null);
    setStatus((prev) => (prev === "error" ? "ready" : prev));
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    regenerate,
    clearError,
    setMessages,
    stop,
  };
}
