/* @vitest-environment node */
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  getMessagePartKey,
  hasVisibleAssistantParts,
  shouldShowThinkingStatus,
} from "./message-parts";

function assistantMessage(parts: UIMessage["parts"], id = "assistant-1"): UIMessage {
  return { id, role: "assistant", parts };
}

function userMessage(text: string, id = "user-1"): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

describe("getMessagePartKey", () => {
  it("keeps text and reasoning keys stable as their text grows", () => {
    expect(getMessagePartKey("m1", { type: "text", text: "Hel" }, 0)).toBe("m1-text-0");
    expect(getMessagePartKey("m1", { type: "text", text: "Hello" }, 0)).toBe("m1-text-0");
    expect(getMessagePartKey("m1", { type: "reasoning", text: "Hmm" }, 1)).toBe("m1-reasoning-1");
    expect(getMessagePartKey("m1", { type: "reasoning", text: "Hmm…" }, 1)).toBe("m1-reasoning-1");
  });

  it("keys tool parts by toolCallId so inserts do not remount them", () => {
    const toolPart = {
      type: "tool-get_registration" as const,
      toolCallId: "call-1",
      state: "input-available" as const,
      input: { domain: "example.com" },
    };

    expect(getMessagePartKey("m1", toolPart, 0)).toBe("m1-call-1");
    expect(getMessagePartKey("m1", toolPart, 2)).toBe("m1-call-1");
  });
});

describe("hasVisibleAssistantParts", () => {
  const hidden = { showReasoning: false, showToolCalls: false };
  const visible = { showReasoning: true, showToolCalls: true };

  it("treats non-empty text as visible", () => {
    expect(hasVisibleAssistantParts(assistantMessage([{ type: "text", text: "Hi" }]), hidden)).toBe(
      true,
    );
    expect(hasVisibleAssistantParts(assistantMessage([{ type: "text", text: "  " }]), hidden)).toBe(
      false,
    );
  });

  it("hides reasoning and tools when those preferences are off", () => {
    expect(
      hasVisibleAssistantParts(
        assistantMessage([
          { type: "reasoning", text: "planning" },
          {
            type: "tool-get_registration",
            toolCallId: "call-1",
            state: "input-available",
            input: {},
          },
        ]),
        hidden,
      ),
    ).toBe(false);
  });

  it("shows reasoning and tools when those preferences are on", () => {
    expect(
      hasVisibleAssistantParts(
        assistantMessage([{ type: "reasoning", text: "planning" }]),
        visible,
      ),
    ).toBe(true);
    expect(
      hasVisibleAssistantParts(
        assistantMessage([
          {
            type: "tool-get_registration",
            toolCallId: "call-1",
            state: "input-available",
            input: {},
          },
        ]),
        visible,
      ),
    ).toBe(true);
  });
});

describe("shouldShowThinkingStatus", () => {
  const options = { showReasoning: false, showToolCalls: true };

  it("shows thinking while submitted or streaming before visible output", () => {
    expect(shouldShowThinkingStatus("submitted", [userMessage("hi")], options)).toBe(true);
    expect(
      shouldShowThinkingStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([{ type: "reasoning", text: "…" }])],
        options,
      ),
    ).toBe(true);
  });

  it("hides thinking once visible assistant output exists", () => {
    expect(
      shouldShowThinkingStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([{ type: "text", text: "Hello" }])],
        options,
      ),
    ).toBe(false);
  });

  it("stays hidden when idle", () => {
    expect(shouldShowThinkingStatus("ready", [userMessage("hi")], options)).toBe(false);
  });
});
