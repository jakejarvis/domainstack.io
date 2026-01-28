import type { UIMessage } from "@ai-sdk/react";

/** Map tool names to human-readable status messages */
const TOOL_STATUS_MESSAGES = {
  get_registration: "Looking up WHOIS data",
  get_dns_records: "Fetching DNS records",
  get_hosting: "Detecting hosting provider",
  get_certificates: "Checking SSL certificate",
  get_headers: "Analyzing HTTP headers",
  get_seo: "Fetching SEO metadata",
} as const;

/** Known tool names from the chat workflow */
export type ToolName = keyof typeof TOOL_STATUS_MESSAGES;

/** Get human-readable status message for a tool type */
export function getToolStatusMessage(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return TOOL_STATUS_MESSAGES[toolName as ToolName] ?? toolName;
}

/** Format messages as markdown for clipboard copy */
export function formatMessagesAsMarkdown(messages: UIMessage[]): string {
  return messages
    .map((message) => {
      const role = message.role === "user" ? "User" : "Assistant";
      const textParts = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n\n");
      return `**${role}:** ${textParts}`;
    })
    .join("\n\n---\n\n");
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
