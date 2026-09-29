/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string }) => Promise<unknown>>(),
}));

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));

import { fetchHttpHeaders } from "./fetch";

describe("fetchHttpHeaders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns every Set-Cookie value as its own header", async () => {
    mocks.safeFetch.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "text/html",
      finalUrl: "https://example.com/",
      buffer: Buffer.alloc(0),
      headers: {
        "content-type": "text/html",
        "set-cookie": "b=2; Path=/",
        server: "nginx",
      },
      setCookies: ["a=1; Path=/", "b=2; Path=/"],
    });

    const result = await fetchHttpHeaders("example.com");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.headers.filter((h) => h.name === "set-cookie")).toEqual([
      { name: "set-cookie", value: "a=1; Path=/" },
      { name: "set-cookie", value: "b=2; Path=/" },
    ]);
    expect(result.data.headers).toContainEqual({ name: "server", value: "nginx" });
    expect(result.data.headers).toContainEqual({ name: "content-type", value: "text/html" });
  });
});
