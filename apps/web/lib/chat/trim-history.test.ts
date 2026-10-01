/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "./request-schema";
import { trimChatHistory } from "./trim-history";

type Role = "user" | "assistant";

const msg = (role: Role, text: string) => ({
  id: text,
  role,
  parts: [{ type: "text" as const, text }],
});

describe("trimChatHistory", () => {
  it("keeps an 11-question conversation within the shared limits", () => {
    const messages = Array.from({ length: 21 }, (_, index) =>
      msg(index % 2 === 0 ? "user" : "assistant", `message-${index}`),
    );

    const result = trimChatHistory(messages);

    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result[0]?.role).toBe("user");
  });

  it("drops a leading assistant message after count trimming", () => {
    const messages = Array.from({ length: 11 }, (_, index) =>
      msg(index % 2 === 0 ? "user" : "assistant", `message-${index}`),
    );

    const result = trimChatHistory(messages, { maxMessages: 10 });

    expect(result).toHaveLength(9);
    expect(result[0]?.role).toBe("user");
    expect(result.at(-1)).toBe(messages.at(-1));
  });

  it("preserves messages under both limits", () => {
    const messages = [msg("user", "question"), msg("assistant", "answer")];

    expect(trimChatHistory(messages)).toEqual(messages);
  });

  it("drops oldest messages until the character budget is met", () => {
    const padding = "x".repeat(25);
    const messages = [
      msg("user", `first-${padding}`),
      msg("assistant", `second-${padding}`),
      msg("user", `third-${padding}`),
      msg("assistant", `fourth-${padding}`),
    ];

    const result = trimChatHistory(messages, { maxChars: 250 });

    expect(result.length).toBeLessThan(messages.length);
    expect(
      result.reduce((total, message) => total + JSON.stringify(message).length, 0),
    ).toBeLessThanOrEqual(250);
    expect(result[0]?.role).toBe("user");
    expect(result.at(-1)).toBe(messages.at(-1));
  });

  it("keeps a final user message larger than the character budget", () => {
    const message = msg("user", "x".repeat(100));

    expect(trimChatHistory([message], { maxChars: 1 })).toEqual([message]);
  });

  it("returns an empty array when no user message survives", () => {
    expect(trimChatHistory([msg("assistant", "answer")])).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(trimChatHistory([])).toEqual([]);
  });

  describe("assistant part cap", () => {
    const assistantWithParts = (count: number) => ({
      id: "assistant-long",
      role: "assistant" as const,
      parts: Array.from({ length: count }, (_, index) => ({
        type: "text" as const,
        text: `part-${index}`,
      })),
    });

    it("keeps only the last 32 parts of an over-cap assistant message", () => {
      const long = assistantWithParts(40);

      const result = trimChatHistory([msg("user", "question"), long]);

      expect(result).toHaveLength(2);
      expect(result[1].parts).toHaveLength(32);
      expect(result[1].parts).toEqual(long.parts.slice(-32));
    });

    it("returns an assistant message with exactly 32 parts unchanged", () => {
      const exact = assistantWithParts(32);

      const result = trimChatHistory([msg("user", "question"), exact]);

      expect(result[1]).toEqual(exact);
      expect(result[1].parts).toHaveLength(32);
    });

    it("never part-trims user messages", () => {
      const user = {
        id: "user-many",
        role: "user" as const,
        parts: Array.from({ length: 40 }, (_, index) => ({
          type: "text" as const,
          text: `part-${index}`,
        })),
      };

      const result = trimChatHistory([user], { maxAssistantParts: 2 });

      expect(result[0].parts).toHaveLength(40);
    });

    it("does not mutate the input array or its messages", () => {
      const long = assistantWithParts(40);
      const messages = [msg("user", "question"), long];
      const snapshot = structuredClone(messages);

      trimChatHistory(messages);

      expect(messages).toEqual(snapshot);
      expect(messages[1]).toBe(long);
      expect(long.parts).toHaveLength(40);
    });

    it("produces history the request schema accepts", () => {
      const history = [msg("user", "question"), assistantWithParts(40), msg("user", "follow-up")];

      expect(chatRequestSchema.safeParse({ messages: history }).success).toBe(false);

      const result = trimChatHistory(history);

      expect(chatRequestSchema.safeParse({ messages: result }).success).toBe(true);
    });
  });
});
