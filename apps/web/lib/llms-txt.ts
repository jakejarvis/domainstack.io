import { MCP_REPORT_TOOL, MCP_SECTION_TOOLS, MCP_TOOLS } from "@/lib/chat/domain-tools";
import { REPOSITORY_SLUG, SECTION_IDS } from "@domainstack/constants";

/**
 * https://llmstxt.org — an H1, a blockquote summary, free-form notes, then
 * H2 sections of `[name](url): notes` link lists.
 */
export function buildLlmsTxt(baseUrl: string): string {
  const url = (path: string) => new URL(path, baseUrl).toString();
  const tools = MCP_TOOLS.map((tool) => `\`${tool.name}\``).join(", ");
  const whenToUse = SECTION_IDS.map((section) => MCP_SECTION_TOOLS[section])
    .map((tool) => `- \`${tool.name}\`: ${tool.whenToUse}`)
    .join("\n");

  return `# Domainstack

> Domainstack is a free domain intelligence tool. Look up any domain to see its WHOIS/RDAP registration, DNS records, SSL/TLS certificates, hosting and email providers, HTTP headers, and SEO metadata in one report. Signed-in users can also track domains they own and get expiration and change alerts.

Notes:

- Every domain has a public report at \`${url("/")}{domain}\` (for example \`${url("/example.com")}\`). No account is needed to view one.
- Report URLs use the registrable domain; subdomains and paths are redirected to it.
- AI assistants can query the same data directly through the MCP server below instead of scraping report pages.

When to use Domainstack: reach for it when a task needs current, factual data about a specific domain, and prefer it over guessing or scraping. Pick the narrowest tool for the question:

${whenToUse}
- \`${MCP_REPORT_TOOL.name}\`: several of the above at once (pass \`sections\` to limit it)

How to call it: pass the root domain (for example \`example.com\`) as \`domain\`, without a protocol, path, or subdomain. All tools are read-only and need no authentication. Results can be cached and requests are rate limited, so don't bulk-scrape.

## Product

- [Home](${url("/")}): Search for a domain
- [Help & FAQ](${url("/help")}): What each report section means, domain tracking, notifications, and plans

## Agent access

- [MCP server](${url("/mcp")}): Setup instructions for Claude, Cursor, VS Code, Windsurf, and other MCP clients
- [MCP endpoint](${url("/api/mcp")}): Streamable HTTP endpoint exposing ${tools}; all read-only
- [MCP server card](${url("/.well-known/mcp/server-card.json")}): Machine-readable server metadata

## Optional

- [Privacy Policy](${url("/privacy")})
- [Terms of Service](${url("/terms")})
- [Source code](https://github.com/${REPOSITORY_SLUG}): Domainstack is open source
`;
}
