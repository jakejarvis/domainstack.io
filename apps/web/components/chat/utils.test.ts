/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { AiModePreference, ChatMode } from "@/lib/stores/preferences-store";

import {
  formatMessagesAsMarkdown,
  getUserFriendlyError,
  LOCAL_HAS_CLOUD_CONVERSATION_MESSAGE,
  LOCAL_NOT_READY_MESSAGE,
  resolveChatMode,
} from "./utils";

describe("resolveChatMode", () => {
  const cases: {
    name: string;
    aiMode: AiModePreference;
    browserReady: boolean;
    hasStoredConversation: boolean;
    lockedMode: ChatMode | null;
    mode: ChatMode;
    blockedReason: string | null;
  }[] = [
    {
      name: "cloud ignores the browser model",
      aiMode: "cloud",
      browserReady: true,
      hasStoredConversation: false,
      lockedMode: null,
      mode: "cloud",
      blockedReason: null,
    },
    {
      name: "auto uses local when ready",
      aiMode: "auto",
      browserReady: true,
      hasStoredConversation: false,
      lockedMode: null,
      mode: "local",
      blockedReason: null,
    },
    {
      name: "auto falls back to cloud when not ready",
      aiMode: "auto",
      browserReady: false,
      hasStoredConversation: false,
      lockedMode: null,
      mode: "cloud",
      blockedReason: null,
    },
    {
      name: "auto stays on cloud with a stored conversation",
      aiMode: "auto",
      browserReady: true,
      hasStoredConversation: true,
      lockedMode: null,
      mode: "cloud",
      blockedReason: null,
    },
    {
      name: "local uses local when ready",
      aiMode: "local",
      browserReady: true,
      hasStoredConversation: false,
      lockedMode: null,
      mode: "local",
      blockedReason: null,
    },
    {
      name: "local blocks sending when the model is not ready",
      aiMode: "local",
      browserReady: false,
      hasStoredConversation: false,
      lockedMode: null,
      mode: "cloud",
      blockedReason: LOCAL_NOT_READY_MESSAGE,
    },
    {
      name: "local blocks sending over a stored cloud conversation",
      aiMode: "local",
      browserReady: true,
      hasStoredConversation: true,
      lockedMode: null,
      mode: "cloud",
      blockedReason: LOCAL_HAS_CLOUD_CONVERSATION_MESSAGE,
    },
    {
      name: "local blocks sending in a conversation locked to cloud",
      aiMode: "local",
      browserReady: true,
      hasStoredConversation: false,
      lockedMode: "cloud",
      mode: "cloud",
      blockedReason: LOCAL_HAS_CLOUD_CONVERSATION_MESSAGE,
    },
  ];

  it.each(cases)("$name", ({ name: _name, mode, blockedReason, ...input }) => {
    expect(resolveChatMode(input)).toEqual({ mode, blockedReason });
  });
});

describe("formatMessagesAsMarkdown", () => {
  it("joins non-empty text parts and skips empty ones", () => {
    const markdown = formatMessagesAsMarkdown([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "When does it expire?" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "text", text: "" },
          { type: "text", text: "January 2034." },
        ],
      },
    ]);

    expect(markdown).toContain("**User:** When does it expire?");
    expect(markdown).toContain("January 2034.");
  });

  it("skips empty messages", () => {
    const markdown = formatMessagesAsMarkdown([
      {
        id: "empty",
        role: "assistant",
        parts: [{ type: "text", text: "   " }],
      },
      {
        id: "assistant-2",
        role: "assistant",
        parts: [{ type: "text", text: "Done." }],
      },
    ]);

    expect(markdown).not.toContain("**Assistant:** \n");
    expect(markdown).toBe("**Assistant:** Done.");
  });
});

describe("getUserFriendlyError", () => {
  it("maps stall and SDK timeouts to a retry message", () => {
    const expected = "This is taking longer than expected. Please try again.";

    expect(getUserFriendlyError(new Error("Chat stream timed out"))).toBe(expected);

    const sdkTimeout = new Error("chunk timeout of 45000ms exceeded");
    sdkTimeout.name = "TimeoutError";
    expect(getUserFriendlyError(sdkTimeout)).toBe(expected);
  });

  it("still prefers the rate limit message", () => {
    expect(getUserFriendlyError(new Error("Failed to fetch chat: 429 rate limit"))).toBe(
      "Too many requests. Please wait a moment and try again.",
    );
  });
});
