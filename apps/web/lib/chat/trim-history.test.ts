/* @vitest-environment node */
import { describe, expect, it } from "vitest";

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
});
