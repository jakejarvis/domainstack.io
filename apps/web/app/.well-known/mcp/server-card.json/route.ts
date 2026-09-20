import { NextResponse } from "next/server";

import { REPOSITORY_SLUG, SECTION_IDS } from "@domainstack/constants";

import { MCP_SECTION_TOOLS } from "../../../../lib/constants/mcp-tools";

const DOMAIN_INPUT_SCHEMA = {
  type: "object",
  properties: {
    domain: { type: "string", description: "Domain name to look up, e.g. example.com" },
  },
  required: ["domain"],
} as const;

const TOOLS = [
  ...SECTION_IDS.map((section) => {
    const { name, title, description } = MCP_SECTION_TOOLS[section];
    return { name, title, description, inputSchema: DOMAIN_INPUT_SCHEMA };
  }),
  {
    name: "domain_report",
    title: "Full Report",
    description:
      "Get a comprehensive domain report combining registration, DNS, hosting, certificates, headers, and SEO data in a single call",
    inputSchema: {
      ...DOMAIN_INPUT_SCHEMA,
      properties: {
        ...DOMAIN_INPUT_SCHEMA.properties,
        sections: {
          type: "array",
          items: { type: "string", enum: [...SECTION_IDS] },
          description: "Sections to include. If omitted, all sections are included.",
        },
      },
    },
  },
];

export function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  return NextResponse.json(
    {
      $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
      name: "io.domainstack/mcp",
      title: "Domainstack",
      description: "WHOIS, DNS, hosting, certificates, headers, SEO, and full-report tools",
      version: "1.0.0",
      websiteUrl: `${baseUrl}/mcp`,
      serverUrl: `${baseUrl}/api/transport/mcp`,
      tools: TOOLS,
      icons: [
        {
          src: `${baseUrl}/apple-icon.png`,
          mimeType: "image/png",
          sizes: ["180x180"],
        },
        {
          src: `${baseUrl}/icon.svg`,
          mimeType: "image/svg+xml",
          sizes: ["any"],
        },
      ],
      repository: {
        url: `https://github.com/${REPOSITORY_SLUG}`,
        source: "github",
      },
      remotes: [
        {
          type: "streamable-http",
          url: `${baseUrl}/api/transport/mcp`,
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
      },
    },
  );
}
