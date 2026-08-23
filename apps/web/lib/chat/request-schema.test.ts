/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  MAX_ASSISTANT_PART_CHARS,
  MAX_ASSISTANT_PARTS,
  MAX_ASSISTANT_TEXT_LENGTH,
  MAX_CONVERSATION_MESSAGES,
  MAX_MESSAGE_LENGTH,
} from "@domainstack/constants";

import { chatRequestSchema } from "./request-schema";

function userMessage(text: string, id = "user-1") {
  return {
    id,
    role: "user" as const,
    parts: [{ type: "text" as const, text }],
  };
}

describe("chatRequestSchema", () => {
  it("accepts a user message at the character limit", () => {
    const result = chatRequestSchema.safeParse({
      messages: [userMessage("x".repeat(MAX_MESSAGE_LENGTH))],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a user text part over the character limit", () => {
    const result = chatRequestSchema.safeParse({
      messages: [userMessage("x".repeat(MAX_MESSAGE_LENGTH + 1))],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some((issue) => issue.message.includes(String(MAX_MESSAGE_LENGTH))),
    ).toBe(true);
  });

  it("does not let oversized user text fall through a non-text part schema", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "x".repeat(MAX_MESSAGE_LENGTH + 1) }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects user parts that are not text", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "file", text: "x".repeat(MAX_MESSAGE_LENGTH + 1) }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts assistant text longer than the user character limit", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("what is the registrar?"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "x".repeat(MAX_MESSAGE_LENGTH + 200) }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts assistant tool parts", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("look up example.com"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "tool-get_registration",
              toolCallId: "call-1",
              state: "output-available",
              input: { domain: "example.com" },
              output: { registrar: "Example Registrar" },
            },
            { type: "text", text: "Example.com is registered." },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty messages array", () => {
    const result = chatRequestSchema.safeParse({ messages: [] });

    expect(result.success).toBe(false);
  });

  it("rejects more messages than the conversation cap", () => {
    const messages = Array.from({ length: MAX_CONVERSATION_MESSAGES * 2 + 1 }, (_, i) =>
      userMessage(`message ${i}`, `user-${i}`),
    );

    const result = chatRequestSchema.safeParse({ messages });

    expect(result.success).toBe(false);
  });

  it("keeps extra fields on messages and assistant parts", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        {
          id: "user-1",
          role: "user",
          createdAt: "2026-08-23T00:00:00.000Z",
          parts: [{ type: "text", text: "hello" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "tool-get_registration",
              toolCallId: "call-1",
              state: "output-available",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.messages[0]).toMatchObject({
      createdAt: "2026-08-23T00:00:00.000Z",
    });
    expect(result.data.messages[1]?.parts[0]).toMatchObject({
      toolCallId: "call-1",
      state: "output-available",
    });
  });

  it("rejects an oversized assistant part type", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("hello"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "x".repeat(65) }],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects assistant text over the assistant character limit", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("what is the registrar?"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "x".repeat(MAX_ASSISTANT_TEXT_LENGTH + 1) }],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some((issue) =>
        issue.message.includes(String(MAX_ASSISTANT_TEXT_LENGTH)),
      ),
    ).toBe(true);
  });

  it("rejects an assistant part whose serialized size exceeds the cap", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("look up example.com"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "tool-get_registration",
              output: "x".repeat(MAX_ASSISTANT_PART_CHARS),
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some((issue) => issue.message.includes(String(MAX_ASSISTANT_PART_CHARS))),
    ).toBe(true);
  });

  it("rejects too many assistant parts", () => {
    const result = chatRequestSchema.safeParse({
      messages: [
        userMessage("hello"),
        {
          id: "assistant-1",
          role: "assistant",
          parts: Array.from({ length: MAX_ASSISTANT_PARTS + 1 }, (_, i) => ({
            type: "text",
            text: `part ${i}`,
          })),
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(
      result.error.issues.some((issue) => issue.message.includes(String(MAX_ASSISTANT_PARTS))),
    ).toBe(true);
  });

  it("rejects a domain longer than 253 characters", () => {
    const result = chatRequestSchema.safeParse({
      messages: [userMessage("hello")],
      domain: "a".repeat(254),
    });

    expect(result.success).toBe(false);
  });
});
