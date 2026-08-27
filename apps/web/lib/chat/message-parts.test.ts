/* @vitest-environment node */
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  getAssistantRenderItems,
  getAssistantWaitStatus,
  getMessagePartKey,
  hasVisibleAssistantParts,
} from "./message-parts";

function assistantMessage(parts: UIMessage["parts"], id = "assistant-1"): UIMessage {
  return { id, role: "assistant", parts };
}

function userMessage(text: string, id = "user-1"): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function registrationTool(
  state: "input-streaming" | "input-available" | "output-available" | "output-error",
  toolCallId = "call-1",
): UIMessage["parts"][number] {
  if (state === "output-available") {
    return {
      type: "tool-get_registration",
      toolCallId,
      state,
      input: { domain: "example.com" },
      output: {},
    };
  }
  if (state === "output-error") {
    return {
      type: "tool-get_registration",
      toolCallId,
      state,
      input: { domain: "example.com" },
      errorText: "failed",
    };
  }
  return {
    type: "tool-get_registration",
    toolCallId,
    state,
    input: { domain: "example.com" },
  };
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

describe("getAssistantWaitStatus", () => {
  const options = { showReasoning: false, showToolCalls: true };

  it("is generating while waiting for the first assistant output", () => {
    expect(getAssistantWaitStatus("submitted", [userMessage("hi")], options)).toEqual({
      placement: "standalone",
      kind: "generating",
    });
  });

  it("is thinking when hidden reasoning is in progress", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([{ type: "reasoning", text: "…", state: "streaming" }]),
        ],
        options,
      ),
    ).toEqual({ placement: "standalone", kind: "thinking" });
  });

  it("hides once visible assistant text exists", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([{ type: "text", text: "Hello" }])],
        options,
      ),
    ).toEqual({ placement: "none", kind: null });
  });

  it("hides while a visible tool is running", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([
            { type: "text", text: "Checking." },
            registrationTool("input-available"),
          ]),
        ],
        options,
      ),
    ).toEqual({ placement: "none", kind: null });
  });

  it("is generating after a tool result before the next text starts", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([
            { type: "text", text: "Checking." },
            registrationTool("output-available"),
          ]),
        ],
        options,
      ),
    ).toEqual({ placement: "inline", kind: "generating" });
  });

  it("is generating when the next text part is still empty after a tool result", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([
            { type: "text", text: "Checking." },
            registrationTool("output-available"),
            { type: "text", text: "", state: "streaming" },
          ]),
        ],
        options,
      ),
    ).toEqual({ placement: "inline", kind: "generating" });
  });

  it("is generating after a tool result when the next step has started", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([registrationTool("output-available"), { type: "step-start" }]),
        ],
        options,
      ),
    ).toEqual({ placement: "inline", kind: "generating" });
  });

  it("hides for an empty text part that has already finished", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([{ type: "text", text: "", state: "done" }])],
        options,
      ),
    ).toEqual({ placement: "none", kind: null });
  });

  it("hides once text resumes after a tool result", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([
            { type: "text", text: "Checking." },
            registrationTool("output-available"),
            { type: "text", text: "Expires in 2034." },
          ]),
        ],
        options,
      ),
    ).toEqual({ placement: "none", kind: null });
  });

  it("is generating after a tool error while composing the follow-up", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([registrationTool("output-error")])],
        options,
      ),
    ).toEqual({ placement: "inline", kind: "generating" });
  });

  it("is generating while a hidden tool is running", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [userMessage("hi"), assistantMessage([registrationTool("input-available")])],
        { showReasoning: false, showToolCalls: false },
      ),
    ).toEqual({ placement: "standalone", kind: "generating" });
  });

  it("stays hidden when idle even if the last part is a completed tool", () => {
    expect(
      getAssistantWaitStatus(
        "ready",
        [userMessage("hi"), assistantMessage([registrationTool("output-available")])],
        options,
      ),
    ).toEqual({ placement: "none", kind: null });
  });

  it("is none when visible reasoning is already showing Thinking", () => {
    expect(
      getAssistantWaitStatus(
        "streaming",
        [
          userMessage("hi"),
          assistantMessage([{ type: "reasoning", text: "…", state: "streaming" }]),
        ],
        { showReasoning: true, showToolCalls: true },
      ),
    ).toEqual({ placement: "none", kind: null });
  });
});

describe("getAssistantRenderItems", () => {
  it("merges consecutive reasoning parts into one block", () => {
    const items = getAssistantRenderItems(
      assistantMessage([
        { type: "reasoning", text: "First.", state: "done" },
        { type: "reasoning", text: "Second.", state: "streaming" },
        { type: "text", text: "Answer." },
      ]),
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: "reasoning",
      text: "First.\n\nSecond.",
      isStreaming: true,
    });
    expect(items[1]).toMatchObject({ kind: "part" });
  });
});
