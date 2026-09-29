/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@domainstack/core/lookup", () => ({
  lookupSection: vi.fn<() => Promise<unknown>>(),
}));

// Keep PostHog unconfigured so the route never schedules `after()` work.
vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

const { GET } = await import("./route");

describe("GET /api/mcp?webmcp-script", () => {
  it("serves the webmcp script with a CDN-cacheable cache-control", async () => {
    const response = await GET(new Request("https://domainstack.io/api/mcp?webmcp-script"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(await response.text()).toContain("https://domainstack.io/api/mcp");
  });
});
