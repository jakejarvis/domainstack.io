/** Map tool names to human-readable status messages */
export const TOOL_STATUS_MESSAGES = {
  getRegistration: "Looking up WHOIS data",
  getDnsRecords: "Fetching DNS records",
  getHosting: "Detecting hosting provider",
  getCertificates: "Checking SSL certificate",
  getHeaders: "Analyzing HTTP headers",
  getSeo: "Fetching SEO metadata",
} as const;

/** Known tool names from the chat workflow */
export type ToolName = keyof typeof TOOL_STATUS_MESSAGES;

/** Get human-readable status message for a tool type */
export function getToolStatusMessage(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return TOOL_STATUS_MESSAGES[toolName as ToolName] ?? toolName;
}
