/** Map tool names to human-readable titles */
export const TOOL_TITLES = {
  getRegistration: "Looking up WHOIS data",
  getDnsRecords: "Fetching DNS records",
  getHosting: "Detecting hosting provider",
  getCertificates: "Checking SSL certificate",
  getHeaders: "Analyzing HTTP headers",
  getSeo: "Fetching SEO metadata",
} as const;

/** Known tool names from the chat workflow */
export type ToolName = keyof typeof TOOL_TITLES;

/** Get human-readable title for a tool type */
export function getToolTitle(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return TOOL_TITLES[toolName as ToolName] ?? toolName;
}
