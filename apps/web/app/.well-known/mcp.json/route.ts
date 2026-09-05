import { NextResponse } from "next/server";

import { REPOSITORY_SLUG } from "@domainstack/constants";

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
