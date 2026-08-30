import type { UIMessage } from "@ai-sdk/react";
import { isTextUIPart } from "ai";

/** Format messages as markdown for clipboard copy */
export function formatMessagesAsMarkdown(messages: UIMessage[]): string {
  const blocks: string[] = [];

  for (const message of messages) {
    const role = message.role === "user" ? "User" : "Assistant";
    const texts: string[] = [];

    for (const part of message.parts) {
      if (!isTextUIPart(part)) continue;
      if (part.text.trim().length === 0) continue;
      texts.push(part.text);
    }

    const text = texts.join("\n\n");
    if (!text) continue;

    blocks.push(`**${role}:** ${text}`);
  }

  return blocks.join("\n\n---\n\n");
}

export function getUserFriendlyError(error: Error): string {
  const message = error.message.toLowerCase();

  // Check for rate limiting first (most specific)
  if (message.includes("429") || message.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Check for server errors (5xx status codes from "Failed to fetch chat: 5xx")
  if (message.includes("500") || message.includes("internal server")) {
    return "Something went wrong on our end. Please try again.";
  }

  // Check for workflow-specific errors
  if (message.includes("workflow") || message.includes("run id")) {
    return "Chat service is not available. Please try again later.";
  }

  // Check for actual network/connection errors (browser-level failures)
  // These are TypeError messages from the browser when fetch truly fails
  const isNetworkError =
    // Browser's actual network error (no response at all)
    (error.name === "TypeError" && message.includes("failed to fetch")) ||
    // Explicit network error messages
    message.includes("networkerror") ||
    message.includes("network error") ||
    // Connection failures
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("etimedout");

  if (isNetworkError) {
    return "Unable to connect. Please check your internet connection.";
  }

  return "Something went wrong. Please try again.";
}
