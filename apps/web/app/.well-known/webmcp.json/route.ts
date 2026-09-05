import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      spec: "webmcp/0.1",
      tools: [
        {
          name: "domain-search",
          description: "Look up WHOIS, DNS, SSL, hosting, HTTP headers, and SEO for any domain",
          url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/`,
          method: "GET",
          parameters: [
            {
              name: "q",
              type: "string",
              description: "Domain name to look up, e.g. example.com",
              required: true,
            },
          ],
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
