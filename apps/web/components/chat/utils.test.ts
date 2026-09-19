/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { formatMessagesAsMarkdown, getUserFriendlyError } from "./utils";

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
