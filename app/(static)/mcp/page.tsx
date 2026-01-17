import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Server",
  description:
    "Connect AI assistants like Claude to Domainstack for domain intelligence lookups.",
};

const MCP_URL = "https://domainstack.io/api/mcp/mcp";

const tools = [
  {
    name: "domain_registration",
    description:
      "Get WHOIS/RDAP registration data including registrar, creation date, expiration date, nameservers, and registrant information.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_registration({ domain: "github.com" })',
  },
  {
    name: "domain_dns",
    description:
      "Get DNS records including A, AAAA, CNAME, MX, TXT, NS, and SOA records.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_dns({ domain: "vercel.com" })',
  },
  {
    name: "domain_hosting",
    description:
      "Detect hosting, DNS, CDN, and email providers by analyzing DNS records and HTTP headers.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_hosting({ domain: "stripe.com" })',
  },
  {
    name: "domain_certificates",
    description:
      "Get SSL/TLS certificate information including issuer, validity dates, and certificate chain.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_certificates({ domain: "cloudflare.com" })',
  },
  {
    name: "domain_headers",
    description:
      "Get HTTP response headers including security headers, caching headers, and server information.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_headers({ domain: "nextjs.org" })',
  },
  {
    name: "domain_seo",
    description:
      "Get SEO metadata including title, description, Open Graph tags, Twitter cards, and robots.txt rules.",
    parameters: [{ name: "domain", type: "string", required: true }],
    example: 'domain_seo({ domain: "linear.app" })',
  },
  {
    name: "domain_report",
    description:
      "Get a comprehensive domain report combining multiple data sources in a single call. Use the sections parameter to request only specific data.",
    parameters: [
      { name: "domain", type: "string", required: true },
      {
        name: "sections",
        type: "array",
        required: false,
        description:
          'Optional array of sections: "dns", "registration", "hosting", "certificates", "headers", "seo". Defaults to all.',
      },
    ],
    example:
      'domain_report({ domain: "example.com", sections: ["dns", "hosting"] })',
  },
];

export default function McpPage() {
  return (
    <>
      <header className="mb-8 border-border/50 border-b pb-8">
        <h1>MCP Server</h1>
        <p className="mt-2 text-muted-foreground">
          Connect AI assistants to Domainstack for domain intelligence.
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
          </a>{" "}
          server that allows AI assistants like Claude to look up domain
          information directly. This enables natural language queries about
          domains without leaving your conversation.
        </p>
      </section>

      <section id="setup">
        <h2>Setup</h2>
        <p>
          Add the Domainstack MCP server to your AI assistant&apos;s
          configuration. The server URL is:
        </p>
        <pre className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/30 p-4 font-mono text-sm">
          {MCP_URL}
        </pre>

        <h3 className="mt-6">Claude Desktop</h3>
        <p>
          Add the following to your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            claude_desktop_config.json
          </code>
          :
        </p>
        <pre className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/30 p-4 font-mono text-sm">
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
        </pre>
        <p className="text-muted-foreground text-sm">
          On macOS, this file is located at{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
        </p>

        <h3 className="mt-6">Claude Code</h3>
        <p>
          Add the following to your project&apos;s{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            .mcp.json
          </code>{" "}
          file:
        </p>
        <pre className="my-4 overflow-x-auto rounded-lg border border-border/50 bg-muted/30 p-4 font-mono text-sm">
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
        </pre>
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
              <p className="mt-2 text-foreground/80 text-sm">
                {tool.description}
              </p>
              <div className="mt-3">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Parameters
                </span>
                <ul className="mt-1 space-y-1 text-sm">
                  {tool.parameters.map((param) => (
                    <li key={param.name} className="font-mono">
                      <span className="text-foreground">{param.name}</span>
                      <span className="text-muted-foreground">
                        : {param.type}
                      </span>
                      {param.required && (
                        <span className="ml-2 text-amber-600 text-xs dark:text-amber-500">
                          required
                        </span>
                      )}
                      {"description" in param && (
                        <span className="ml-2 font-sans text-muted-foreground text-xs">
                          {param.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Example
                </span>
                <pre className="mt-1 overflow-x-auto rounded border border-border/30 bg-background/50 p-2 font-mono text-xs">
                  {tool.example}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="examples">
        <h2>Example Prompts</h2>
        <p>Once configured, you can ask Claude questions like:</p>
        <ul>
          <li>&quot;What hosting provider does stripe.com use?&quot;</li>
          <li>&quot;When does the github.com domain expire?&quot;</li>
          <li>&quot;Show me the DNS records for vercel.com&quot;</li>
          <li>&quot;What SSL certificate does cloudflare.com have?&quot;</li>
          <li>
            &quot;Give me a full report on linear.app including DNS and
            hosting&quot;
          </li>
          <li>&quot;Check the SEO metadata for nextjs.org&quot;</li>
        </ul>
      </section>

      <section id="rate-limits">
        <h2>Rate Limits</h2>
        <p>
          The MCP server is rate limited to{" "}
          <strong>30 requests per minute</strong> per IP address. This applies
          across all tool calls. If you exceed the limit, requests will return a
          429 error with a{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            Retry-After
          </code>{" "}
          header.
        </p>
        <p>
          For most conversational use cases, this limit is more than sufficient.
          The{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            domain_report
          </code>{" "}
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
          If data appears stale, a background refresh is triggered automatically
          and fresh data will be available on the next request.
        </p>
      </section>
    </>
  );
}
