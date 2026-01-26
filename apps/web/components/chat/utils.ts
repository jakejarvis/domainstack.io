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
