/** Map tool names to human-readable titles */
export const TOOL_TITLES: Record<string, string> = {
  getRegistration: "Looking up WHOIS data",
  getDnsRecords: "Fetching DNS records",
  getHosting: "Detecting hosting provider",
  getCertificates: "Checking SSL certificate",
  getHeaders: "Analyzing HTTP headers",
  getSeo: "Fetching SEO metadata",
};

/** Get human-readable title for a tool type */
export function getToolTitle(type: string): string {
  const toolName = type.replace(/^tool-/, "");
  return TOOL_TITLES[toolName] ?? toolName;
}
