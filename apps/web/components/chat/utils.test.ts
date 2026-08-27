/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatMessagesAsMarkdown } from "./utils";

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
