import { NextResponse } from "next/server";
import { z } from "zod";

import { REPOSITORY_SLUG } from "@domainstack/constants";

import { MCP_TOOLS } from "../../../../lib/constants/mcp-tools";

const TOOLS = MCP_TOOLS.map((tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: z.toJSONSchema(tool.inputSchema),
}));

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
      serverUrl: `${baseUrl}/api/mcp`,
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
          url: `${baseUrl}/api/mcp`,
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
