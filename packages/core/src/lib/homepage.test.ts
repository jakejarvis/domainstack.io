/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock("@domainstack/safe-fetch", () => ({ safeFetch: mocks.safeFetch }));

import { fetchHomepage } from "./homepage";

const PAGE = { ok: true, status: 200, headers: {}, setCookies: [], buffer: Buffer.alloc(0) };

describe("fetchHomepage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.safeFetch.mockResolvedValue(PAGE);
  });

  it("follows redirects between the apex and www only, returning an off-host redirect", async () => {
    await fetchHomepage("Example.com");

    expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://Example.com/",
        method: "GET",
        allowedHosts: ["example.com", "www.example.com"],
        returnOnDisallowedRedirect: true,
      }),
    );
  });

  it("shares one GET between concurrent callers", async () => {
    const [a, b] = await Promise.all([fetchHomepage("example.com"), fetchHomepage("example.com")]);

    expect(mocks.safeFetch).toHaveBeenCalledOnce();
    expect(a).toBe(b);
  });

  it("does not share a HEAD, which falls back to GET on 405", async () => {
    await Promise.all([
      fetchHomepage("example.com"),
      fetchHomepage("example.com", { method: "HEAD" }),
    ]);

    expect(mocks.safeFetch).toHaveBeenCalledTimes(2);
    expect(mocks.safeFetch).toHaveBeenCalledWith(
      expect.objectContaining({ method: "HEAD", fallbackToGetOnHeadFailure: true }),
    );
  });
});
