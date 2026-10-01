/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookupSection: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("@domainstack/core/lookup", () => ({ lookupSection: mocks.lookupSection }));

import { MCP_REPORT_TOOL, MCP_SECTION_TOOLS, RATE_LIMIT_MESSAGE } from "@/lib/chat/domain-tools";
import { RateLimitError } from "@domainstack/redis/enforce";

// Keep PostHog unconfigured so the route never schedules `after()` work.
vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

const { GET, POST } = await import("./route");

describe("GET /api/mcp?webmcp-script", () => {
  it("serves the webmcp script with a CDN-cacheable cache-control", async () => {
    const response = await GET(new Request("https://domainstack.io/api/mcp?webmcp-script"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(await response.text()).toContain("https://domainstack.io/api/mcp");
  });
});

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const response = await POST(
    new Request("https://domainstack.io/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  );
  return response.text();
}

describe("POST /api/mcp tools/call", () => {
  const sectionTool = MCP_SECTION_TOOLS.dns.name;

  beforeEach(() => {
    mocks.lookupSection.mockReset();
  });

  it("returns a fixed message when a section lookup throws an internal error", async () => {
    mocks.lookupSection.mockRejectedValue(
      new Error("Failed query: select * from t params: secret"),
    );

    const body = await callTool(sectionTool, { domain: "example.com" });

    expect(body).toContain("Unable to fetch data");
    expect(body).not.toContain("Failed query");
    expect(body).not.toContain("secret");
  });

  it("returns the rate-limit message when a section lookup is rate limited", async () => {
    mocks.lookupSection.mockRejectedValue(
      new RateLimitError(30, { limit: 60, remaining: 0, reset: Date.now() + 30_000 }),
    );

    expect(await callTool(sectionTool, { domain: "example.com" })).toContain(RATE_LIMIT_MESSAGE);
  });

  it("does not leak internal error text from the report tool", async () => {
    mocks.lookupSection.mockRejectedValue(
      new Error("Failed query: select * from t params: secret"),
    );

    const body = await callTool(MCP_REPORT_TOOL.name, { domain: "example.com", sections: ["dns"] });

    expect(body).toContain("Unable to fetch data");
    expect(body).not.toContain("Failed query");
  });

  it("truncates oversized fields in a section result", async () => {
    mocks.lookupSection.mockResolvedValue({
      success: true,
      cached: false,
      data: { title: "t".repeat(5_000) },
    });

    const body = await callTool(sectionTool, { domain: "example.com" });

    expect(body).toContain("[truncated]");
    expect(body).not.toContain("t".repeat(1_500));
  });
});
