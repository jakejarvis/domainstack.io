import { SiModelcontextprotocol } from "@icons-pack/react-simple-icons";
import {
  Claude as ClaudeIcon,
  Cline as ClineIcon,
  Cursor as CursorIcon,
  Gemini as GeminiIcon,
  OpenAI as OpenAIIcon,
  Windsurf as WindsurfIcon,
} from "@lobehub/icons";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
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
      <header>
        <h1 className="flex items-center gap-2.5">
          <SiModelcontextprotocol className="text-foreground/70" />
          MCP Server
          <Badge
            variant="secondary"
            className="ml-1 text-[13px] tracking-normal"
          >
            Beta
          </Badge>
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
            <ArrowSquareOutIcon />
          </a>{" "}
          server that allows AI assistants to look up domain information
          directly. This enables natural language queries about domains without
          leaving your conversation.
        </p>
      </section>

      <section id="setup">
        <h2>Setup</h2>

        <Accordion className="w-full rounded-lg border border-border/50 bg-muted/20">
          <AccordionItem
            value="claude-code"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <ClaudeIcon className="size-4 text-muted-foreground" />
                Claude Code
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p>Run this command to add Domainstack to Claude Code:</p>
              <CodeBlock>{`claude mcp add domainstack --transport http ${MCP_URL}`}</CodeBlock>
              <p className="text-muted-foreground">
                Or add this snippet to your project&apos;s{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  .mcp.json
                </code>{" "}
                file:
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcpServers: {
                      domainstack: {
                        url: MCP_URL,
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://code.claude.com/docs/en/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Claude Code docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="claude-desktop"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <ClaudeIcon className="size-4 text-muted-foreground" />
                Claude.ai / Claude Desktop
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p>
                Open Claude Desktop and navigate to{" "}
                <strong>
                  Settings &rarr; Connectors &rarr; Add Custom Connector
                </strong>
                . Set the server URL to:
              </p>
              <CodeBlock>{MCP_URL}</CodeBlock>
              <p className="mt-2 text-muted-foreground">
                Alternatively, edit your{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  claude_desktop_config.json
                </code>{" "}
                (on macOS:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  ~/Library/Application
                  Support/Claude/claude_desktop_config.json
                </code>
                ):
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcpServers: {
                      domainstack: {
                        url: MCP_URL,
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://modelcontextprotocol.io/docs/develop/connect-remote-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Claude docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="cursor"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <CursorIcon className="size-4 text-muted-foreground" />
                Cursor
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
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
                Click the button above to install automatically, or add this
                snippet to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  ~/.cursor/mcp.json
                </code>
                :
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcpServers: {
                      domainstack: {
                        url: MCP_URL,
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://docs.cursor.com/context/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Cursor docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="vscode"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
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
                VS Code
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p className="mb-4 flex justify-center text-center">
                <a
                  href={VSCODE_DEEPLINK}
                  className="!no-underline hover:!text-white inline-flex items-center gap-2 rounded-md bg-[#0066b8] p-2.5 font-medium text-white leading-none transition-colors hover:bg-[#005ba4]"
                  data-disable-progress
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    className="mt-[3px] inline-block size-4"
                  >
                    <title>VS Code</title>
                    <path d="M23.15 2.587L18.21.21a1.49 1.49 0 0 0-1.705.29l-9.46 8.63l-4.12-3.128a1 1 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12L.326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a1 1 0 0 0 1.276.057l4.12-3.128l9.46 8.63a1.49 1.49 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352m-5.146 14.861L10.826 12l7.178-5.448z" />
                  </svg>
                  Install in VS Code
                </a>
              </p>
              <p>
                Click the button above to install automatically, or add this
                snippet to your VS Code settings:
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcp: {
                      servers: {
                        domainstack: {
                          type: "http",
                          url: MCP_URL,
                        },
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View VS Code docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="windsurf"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <WindsurfIcon className="size-4 text-muted-foreground" />
                Windsurf
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p>
                Add this snippet to your Windsurf MCP config (
                <code className="rounded bg-muted px-1.5 py-0.5">
                  ~/.windsurf/mcp.json
                </code>
                ):
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcpServers: {
                      domainstack: {
                        serverUrl: MCP_URL,
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://docs.windsurf.com/windsurf/cascade/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Windsurf docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="cline"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <ClineIcon className="size-4 text-muted-foreground" />
                Cline
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p>
                Open Cline, click the hamburger menu, go to{" "}
                <strong>MCP Servers &rarr; Remote Servers</strong>, and add this
                snippet:
              </p>
              <CodeBlock>
                {JSON.stringify(
                  {
                    mcpServers: {
                      domainstack: {
                        url: MCP_URL,
                        type: "streamableHttp",
                      },
                    },
                  },
                  null,
                  2,
                )}
              </CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://docs.cline.bot/mcp/configuring-mcp-servers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Cline docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="codex"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <OpenAIIcon className="size-4 text-muted-foreground" />
                Codex CLI
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
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
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://developers.openai.com/codex/mcp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Codex docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="gemini"
            className="border-border/30 border-b px-4 last:border-none"
          >
            <AccordionTrigger className="cursor-pointer text-left tracking-[0.01em] decoration-muted-foreground/50 hover:text-foreground/90 hover:underline hover:underline-offset-4">
              <span className="flex items-center gap-2.5">
                <GeminiIcon className="size-4 text-muted-foreground" />
                Gemini CLI
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 text-foreground/90">
              <p>Run this command to add Domainstack to Gemini CLI:</p>
              <CodeBlock>{`gemini mcp add domainstack --transport http ${MCP_URL}`}</CodeBlock>
              <p className="!text-xs mt-2 text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://geminicli.com/docs/tools/mcp-server/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5"
                >
                  View Gemini CLI docs
                  <ArrowSquareOutIcon className="!size-3" />
                </a>
              </p>
            </AccordionContent>
          </AccordionItem>
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
              className="rounded-lg border border-border/50 bg-muted/20 p-4"
            >
              <h3 className="font-mono text-base">{tool.name}</h3>
              <p className="!text-[14px] mt-2 text-foreground/80">
                {tool.description}
              </p>
              <div className="mt-3">
                <span className="!text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Parameters
                </span>
                <ul className="!pl-2 mt-2 space-y-1 [&_li]:list-none">
                  {tool.parameters.map((param) => (
                    <li key={param.name} className="!text-[14px] font-mono">
                      <span className="text-foreground">{param.name}</span>
                      <span className="text-muted-foreground">
                        : {param.type}
                      </span>
                      {param.required && (
                        <Badge variant="secondary" className="ml-2 leading-4">
                          required
                        </Badge>
                      )}
                      {"description" in param && (
                        <span className="!text-xs ml-2 font-sans text-muted-foreground">
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
          return a 429 error with a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">Retry-After</code>{" "}
          header.
        </p>
        <p>
          The{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">domain_report</code>{" "}
          tool is useful for reducing the number of calls when you need multiple
          data types.
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
