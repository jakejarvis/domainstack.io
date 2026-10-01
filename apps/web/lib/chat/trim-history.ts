import {
  MAX_ASSISTANT_PARTS,
  MAX_CONVERSATION_HISTORY_CHARS,
  MAX_CONVERSATION_MESSAGES,
} from "@domainstack/constants";

type HistoryMessage = { role: string; parts?: readonly unknown[] };

/**
 * Trim chat history to what the server accepts and the model should see.
 *
 * - Keeps at most `maxMessages` of the most recent messages.
 * - Keeps only the last `maxAssistantParts` parts of an assistant message, so a
 *   long multi-step reply never trips the server's per-message part cap. The
 *   tail is kept because the final answer text is at the end.
 * - Drops oldest messages while the JSON-serialized history exceeds `maxChars`,
 *   but never drops the final message.
 * - Drops leading non-user messages so the history always starts with a user
 *   turn (providers reject histories that open with an assistant tool call).
 *
 * Returns an empty array when no user message survives. Does not mutate its input.
 */
export function trimChatHistory<T extends HistoryMessage>(
  messages: readonly T[],
  {
    maxMessages = MAX_CONVERSATION_MESSAGES,
    maxChars = MAX_CONVERSATION_HISTORY_CHARS,
    maxAssistantParts = MAX_ASSISTANT_PARTS,
  }: { maxMessages?: number; maxChars?: number; maxAssistantParts?: number } = {},
): T[] {
  let trimmed = messages
    .slice(-maxMessages)
    .map((message) =>
      message.role === "assistant" && message.parts && message.parts.length > maxAssistantParts
        ? Object.assign({}, message, { parts: message.parts.slice(-maxAssistantParts) })
        : message,
    );

  const sizes = trimmed.map((message) => JSON.stringify(message).length);
  let total = sizes.reduce((sum, size) => sum + size, 0);
  let start = 0;
  while (total > maxChars && start < trimmed.length - 1) {
    total -= sizes[start];
    start++;
  }
  trimmed = trimmed.slice(start);

  const firstUser = trimmed.findIndex((message) => message.role === "user");
  return firstUser === -1 ? [] : trimmed.slice(firstUser);
}
