/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { validateChatMessages } from "./validate-messages";

describe("validateChatMessages", () => {
  it("accepts known tool history", async () => {
    const result = await validateChatMessages([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "look up example.com" }],
      },
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
        ],
      },
    ]);

    expect(result.success).toBe(true);
  });

  it("rejects an unknown tool part", async () => {
    const result = await validateChatMessages([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "look up example.com" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-drop_all_tables",
            toolCallId: "call-1",
            state: "input-available",
            input: { domain: "example.com" },
          },
        ],
      },
    ]);

    expect(result.success).toBe(false);
  });
});
