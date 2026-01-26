import {
  SiClaude,
  SiGooglegemini,
  SiModelcontextprotocol,
  SiWindsurf,
} from "@icons-pack/react-simple-icons";
import {
  IconBook2,
  IconBrandOpenai,
  IconExternalLink,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Image from "next/image";
import { BetaBadge } from "@/components/beta-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { BASE_URL } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: "MCP (Beta)",
  description:
    "Connect AI assistants like Claude to Domainstack for domain intelligence lookups.",
};

const MCP_URL = `${BASE_URL}/api/transport/mcp`;

// Cursor deeplink: cursor://anysphere.cursor-deeplink/mcp/install?name=...&config=...
// https://cursor.com/docs/context/mcp/install-links
const CURSOR_CONFIG = { url: MCP_URL };
const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=domainstack&config=${btoa(JSON.stringify(CURSOR_CONFIG))}`;

// VS Code deeplink: vscode:mcp/install?{urlEncodedConfig}
// https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_url-handler
const VSCODE_CONFIG = { name: "domainstack", type: "http", url: MCP_URL };
const VSCODE_DEEPLINK = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(VSCODE_CONFIG))}`;

type SetupItem = {
  id: string;
  icon: React.ReactNode;
  label: string;
  content: React.ReactNode;
  docsUrl: string;
  docsLabel: string;
};

const setupItems: SetupItem[] = [
  {
    id: "claude-code",
    icon: <SiClaude className="size-4 text-muted-foreground" />,
    label: "Claude Code",
    docsUrl: "https://code.claude.com/docs/en/mcp",
    docsLabel: "View Claude Code docs",
    content: (
      <>
        <p>Run this command to add Domainstack to Claude Code:</p>
        <CodeBlock>{`claude mcp add domainstack --transport http ${MCP_URL}`}</CodeBlock>
        <p>
          Or add this snippet to your project&apos;s{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">.mcp.json</code>{" "}
          file:
        </p>
        <CodeBlock>
          {JSON.stringify(
            { mcpServers: { domainstack: { url: MCP_URL } } },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
  {
    id: "claude-desktop",
    icon: <SiClaude className="size-4 text-muted-foreground" />,
    label: "Claude.ai / Claude Desktop",
    docsUrl:
      "https://modelcontextprotocol.io/docs/develop/connect-remote-servers",
    docsLabel: "View Claude docs",
    content: (
      <>
        <p>
          Open Claude Desktop and navigate to{" "}
          <strong>
            Settings &rarr; Connectors &rarr; Add Custom Connector
          </strong>
          . Set the server URL to:
        </p>
        <CodeBlock>{MCP_URL}</CodeBlock>
        <p>
          Alternatively, edit your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            claude_desktop_config.json
          </code>{" "}
          (on macOS:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
          ):
        </p>
        <CodeBlock>
          {JSON.stringify(
            { mcpServers: { domainstack: { url: MCP_URL } } },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
  {
    id: "cursor",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        className="size-4 text-muted-foreground"
      >
        <title>Cursor</title>
        <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
      </svg>
    ),
    label: "Cursor",
    docsUrl: "https://docs.cursor.com/context/mcp",
    docsLabel: "View Cursor docs",
    content: (
      <>
        <p className="mb-4 flex justify-center text-center">
          <a href={CURSOR_DEEPLINK} data-disable-progress>
            <Image
              src="https://cursor.com/deeplink/mcp-install-light.svg"
              alt="Add domainstack MCP server to Cursor"
              width={128}
              height={32}
            />
          </a>
        </p>
        <p>
          Click the button above to install automatically, or add this snippet
          to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ~/.cursor/mcp.json
          </code>
          :
        </p>
        <CodeBlock>
          {JSON.stringify(
            { mcpServers: { domainstack: { url: MCP_URL } } },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
  {
    id: "vscode",
    icon: (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        className="size-4 text-muted-foreground"
      >
        <title>VS Code</title>
        <path d="M23.15 2.587L18.21.21a1.49 1.49 0 0 0-1.705.29l-9.46 8.63l-4.12-3.128a1 1 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12L.326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a1 1 0 0 0 1.276.057l4.12-3.128l9.46 8.63a1.49 1.49 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352m-5.146 14.861L10.826 12l7.178-5.448z" />
      </svg>
    ),
    label: "VS Code",
    docsUrl: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
    docsLabel: "View VS Code docs",
    content: (
      <>
        <p className="mb-4 flex justify-center text-center">
          <a
            href={VSCODE_DEEPLINK}
            className="!no-underline hover:!text-white inline-flex items-center gap-2 rounded-md bg-[#0066b8] p-3 font-medium text-white leading-none transition-colors hover:bg-[#005ba4]"
            data-disable-progress
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              className="inline-block size-4"
            >
              <title>VS Code</title>
              <path d="M23.15 2.587L18.21.21a1.49 1.49 0 0 0-1.705.29l-9.46 8.63l-4.12-3.128a1 1 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12L.326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a1 1 0 0 0 1.276.057l4.12-3.128l9.46 8.63a1.49 1.49 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352m-5.146 14.861L10.826 12l7.178-5.448z" />
            </svg>
            Install in VS Code
          </a>
        </p>
        <p>
          Click the button above to install automatically, or add this snippet
          to your VS Code settings:
        </p>
        <CodeBlock>
          {JSON.stringify(
            {
              mcp: {
                servers: { domainstack: { type: "http", url: MCP_URL } },
              },
            },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
  {
    id: "codex",
    icon: <IconBrandOpenai className="size-4 text-muted-foreground" />,
    label: "Codex CLI",
    docsUrl: "https://developers.openai.com/codex/mcp/",
    docsLabel: "View Codex docs",
    content: (
      <>
        <p>Run this command to add Domainstack to Codex:</p>
        <CodeBlock>{`codex mcp add domainstack --url ${MCP_URL}`}</CodeBlock>
        <p className="text-muted-foreground">
          Enable remote MCP client support by adding this to your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ~/.codex/config.toml
          </code>
          :
        </p>
        <CodeBlock>{`[features]\nrmcp_client = true`}</CodeBlock>
      </>
    ),
  },
  {
    id: "gemini",
    icon: <SiGooglegemini className="size-4 text-muted-foreground" />,
    label: "Gemini CLI",
    docsUrl: "https://geminicli.com/docs/tools/mcp-server/",
    docsLabel: "View Gemini CLI docs",
    content: (
      <>
        <p>Run this command to add Domainstack to Gemini CLI:</p>
        <CodeBlock>{`gemini mcp add domainstack --transport http ${MCP_URL}`}</CodeBlock>
      </>
    ),
  },
  {
    id: "windsurf",
    icon: <SiWindsurf className="size-4 text-muted-foreground" />,
    label: "Windsurf",
    docsUrl: "https://docs.windsurf.com/windsurf/cascade/mcp",
    docsLabel: "View Windsurf docs",
    content: (
      <>
        <p>
          Add this snippet to your Windsurf MCP config (
          <code className="rounded bg-muted px-1.5 py-0.5">
            ~/.windsurf/mcp.json
          </code>
          ):
        </p>
        <CodeBlock>
          {JSON.stringify(
            { mcpServers: { domainstack: { serverUrl: MCP_URL } } },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
  {
    id: "cline",
    icon: (
      <svg
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4 text-muted-foreground"
      >
        <title>Cline</title>
        <path d="M17.035 3.991c2.75 0 4.98 2.24 4.98 5.003v1.667l1.45 2.896a1.01 1.01 0 01-.002.909l-1.448 2.864v1.668c0 2.762-2.23 5.002-4.98 5.002H7.074c-2.751 0-4.98-2.24-4.98-5.002V17.33l-1.48-2.855a1.01 1.01 0 01-.003-.927l1.482-2.887V8.994c0-2.763 2.23-5.003 4.98-5.003h9.962zM8.265 9.6a2.274 2.274 0 00-2.274 2.274v4.042a2.274 2.274 0 004.547 0v-4.042A2.274 2.274 0 008.265 9.6zm7.326 0a2.274 2.274 0 00-2.274 2.274v4.042a2.274 2.274 0 104.548 0v-4.042A2.274 2.274 0 0015.59 9.6z"></path>
        <path d="M12.054 5.558a2.779 2.779 0 100-5.558 2.779 2.779 0 000 5.558z"></path>
      </svg>
    ),
    label: "Cline",
    docsUrl: "https://docs.cline.bot/mcp/configuring-mcp-servers",
    docsLabel: "View Cline docs",
    content: (
      <>
        <p>
          Open Cline, click the hamburger menu, go to{" "}
          <strong>MCP Servers &rarr; Remote Servers</strong>, and add this
          snippet:
        </p>
        <CodeBlock>
          {JSON.stringify(
            {
              mcpServers: {
                domainstack: { url: MCP_URL, type: "streamableHttp" },
              },
            },
            null,
            2,
          )}
        </CodeBlock>
      </>
    ),
  },
];

const tools = [
  {
    name: "domain_registration",
    description:
      "Get WHOIS/RDAP registration data including registrar, creation date, expiration date, nameservers, and registrant information.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_dns",
    description:
      "Get DNS records including A, AAAA, CNAME, MX, TXT, NS, and SOA records.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers by analyzing DNS records and HTTP headers.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_certificates",
    description:
      "Get SSL/TLS certificate information including issuer, validity dates, and certificate chain.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_headers",
    description:
      "Get HTTP response headers including security headers, caching headers, and server information.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_seo",
    description:
      "Get SEO metadata including title, description, Open Graph tags, Twitter cards, and robots.txt rules.",
    parameters: [{ name: "domain", type: "string", required: true }],
  },
  {
    name: "domain_report",
    description:
      "Get a comprehensive domain report combining multiple data sources in a single call. Use the sections parameter to request only specific data.",
    parameters: [
      { name: "domain", type: "string", required: true },
      {
        name: "sections",
        type: "string[]",
        required: false,
        description:
          'Array of section(s) to compile: "dns", "registration", "hosting", "certificates", "headers", "seo". Defaults to all.',
      },
    ],
  },
];

export default function McpPage() {
  return (
    <>
      <header className="not-prose">
        <h1 className="flex items-center gap-2.5 font-semibold text-2xl tracking-tight">
          <SiModelcontextprotocol className="text-foreground/70" />
          MCP Server
          <BetaBadge className="ml-0.5 font-semibold text-sm tracking-normal" />
        </h1>
        <p className="mt-2 text-muted-foreground">
          Connect AI assistants to Domainstack for instant domain intelligence.
        </p>
      </header>

      <section>
        <p>
          Domainstack exposes a{" "}
          <a
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Model Context Protocol (MCP)
            <IconExternalLink />
          </a>{" "}
          server that allows AI assistants to look up domain information
          directly. This enables natural language queries about domains without
          leaving your conversation.
        </p>
      </section>

      <section id="setup">
        <h2>Setup</h2>

        <Accordion className="not-prose w-full rounded-lg border bg-muted/20">
          {setupItems.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="border-border border-b px-4 last:border-none"
            >
              <AccordionTrigger className="text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  {item.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1 text-foreground/90">
                {item.content}
                <p className="mt-2 flex items-center gap-1 text-muted-foreground text-xs leading-relaxed">
                  <IconBook2 className="mr-[1px] size-3" />
                  Need help?
                  <a
                    href={item.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    {item.docsLabel}
                    <IconExternalLink className="size-3 -translate-y-[1px]" />
                  </a>
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section id="tools">
        <h2>Available Tools</h2>
        <p>
          The MCP server provides {tools.length} tools for domain intelligence:
        </p>

        <div className="mt-6 space-y-6">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="not-prose space-y-3 rounded-lg border bg-muted/20 p-4"
            >
              <h3 className="font-mono text-[15px]">{tool.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {tool.description}
              </p>
              <div>
                <span className="font-medium text-foreground/75 text-xs uppercase tracking-wide">
                  Parameters
                </span>
                <ul className="mt-2 space-y-1 pl-2 [&_li]:list-none">
                  {tool.parameters.map((param) => (
                    <li key={param.name} className="space-x-2">
                      <span className="font-mono text-[13px] text-foreground">
                        {param.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs lowercase leading-4"
                      >
                        {param.type}
                      </Badge>
                      {param.required && (
                        <Badge
                          variant="destructive"
                          className="text-xs lowercase leading-4"
                        >
                          Required
                        </Badge>
                      )}
                      {"description" in param && (
                        <span className="font-sans text-muted-foreground text-xs">
                          {param.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="examples">
        <h2>Example Prompts</h2>
        <p>Once configured, you can ask questions like:</p>
        <ul>
          <li>&ldquo;Which hosting provider does stripe.com use?&rdquo;</li>
          <li>&ldquo;When does the github.com domain expire?&rdquo;</li>
          <li>&ldquo;Show me the DNS records for vercel.com&rdquo;</li>
          <li>&ldquo;What SSL certificate does nytimes.com have?&rdquo;</li>
          <li>
            &ldquo;Give me a full report on linear.app including DNS and
            hosting.&rdquo;
          </li>
          <li>&ldquo;Check the SEO metadata for nextjs.org.&rdquo;</li>
        </ul>
      </section>

      <section id="rate-limits">
        <h2>Rate Limits</h2>
        <p>
          The MCP server is dynamically rate limited to meet demand. This
          applies across all tool calls. If you exceed the limit, requests will
          return a 429 error with a <code>Retry-After</code> header.
        </p>
        <p>
          The <code>domain_report</code> tool is useful for reducing the number
          of calls when you need multiple data types.
        </p>
      </section>

      <section id="data-freshness">
        <h2>Data Freshness</h2>
        <p>
          Domain data is cached and refreshed automatically. Different data
          types have different refresh intervals:
        </p>
        <ul>
          <li>
            <strong>DNS records</strong> &mdash; Refreshed frequently (minutes
            to hours)
          </li>
          <li>
            <strong>HTTP headers</strong> &mdash; Refreshed frequently (minutes
            to hours)
          </li>
          <li>
            <strong>Registration data</strong> &mdash; Refreshed less frequently
            (hours to days)
          </li>
          <li>
            <strong>SSL certificates</strong> &mdash; Refreshed based on expiry
            proximity
          </li>
          <li>
            <strong>SEO metadata</strong> &mdash; Refreshed periodically (hours)
          </li>
        </ul>
        <p>
          If data appears stale, a background refresh was likely triggered
          automatically and fresh data will be available soon.
        </p>
      </section>
    </>
  );
}
