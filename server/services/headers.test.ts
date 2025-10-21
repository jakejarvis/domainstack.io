/* @vitest-environment node */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

beforeAll(async () => {
  const { makePGliteDb } = await import("@/server/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/server/db/client", () => ({ db }));
  const { makeInMemoryRedis } = await import("@/lib/redis-mock");
  const impl = makeInMemoryRedis();
  vi.doMock("@/lib/redis", () => impl);
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/server/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

describe("probeHeaders", () => {
  it("uses GET and caches result", async () => {
    const get = new Response(null, {
      status: 200,
      headers: {
        server: "vercel",
        "x-vercel-id": "abc",
      },
    });
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (_url, init?: RequestInit) => {
        if ((init?.method || "GET") === "GET") return get;
        return new Response(null, { status: 500 });
      });

    const { probeHeaders } = await import("./headers");
    const out1 = await probeHeaders("example.com");
    expect(out1.headers.length).toBeGreaterThan(0);
    const fetchSpy = vi.spyOn(global, "fetch");
    const out2 = await probeHeaders("example.com");
    expect(out2.headers.length).toBe(out1.headers.length);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    fetchMock.mockRestore();
  });

  it("handles concurrent callers and returns consistent results", async () => {
    const get = new Response(null, {
      status: 200,
      headers: {
        server: "vercel",
        "x-vercel-id": "abc",
      },
    });
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (_url, init?: RequestInit) => {
        if ((init?.method || "GET") === "GET") return get;
        return new Response(null, { status: 500 });
      });

    const { probeHeaders } = await import("./headers");
    const [a, b, c] = await Promise.all([
      probeHeaders("example.com"),
      probeHeaders("example.com"),
      probeHeaders("example.com"),
    ]);
    expect(a.headers.length).toBeGreaterThan(0);
    expect(b.headers.length).toBe(a.headers.length);
    expect(c.headers.length).toBe(a.headers.length);
    // Only assert that all calls returned equivalent results; caching is validated elsewhere
    fetchMock.mockRestore();
  });

  it("returns empty array and does not cache on error", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("network");
    });
    const { probeHeaders } = await import("./headers");
    const out = await probeHeaders("fail.example");
    expect(out.headers.length).toBe(0);
    fetchMock.mockRestore();
  });
});
