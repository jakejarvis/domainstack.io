import { MAX_CONVERSATION_HISTORY_CHARS, MAX_CONVERSATION_MESSAGES } from "@domainstack/constants";

type HistoryMessage = { role: string };

/**
 * Trim chat history to what the server accepts and the model should see.
 *
 * - Keeps at most `maxMessages` of the most recent messages.
 * - Drops oldest messages while the JSON-serialized history exceeds `maxChars`,
 *   but never drops the final message.
 * - Drops leading non-user messages so the history always starts with a user
 *   turn (providers reject histories that open with an assistant tool call).
 *
 * Returns an empty array when no user message survives.
 */
export function trimChatHistory<T extends HistoryMessage>(
  messages: readonly T[],
  {
    maxMessages = MAX_CONVERSATION_MESSAGES,
    maxChars = MAX_CONVERSATION_HISTORY_CHARS,
  }: { maxMessages?: number; maxChars?: number } = {},
): T[] {
  let trimmed = messages.slice(-maxMessages);

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
