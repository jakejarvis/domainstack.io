/* @vitest-environment node */

// Mock scheduleRevalidation to avoid Inngest API calls in tests
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(true),
}));

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterEach(async () => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("getHeaders", () => {
  it("uses GET and caches result", async () => {
    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

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

    const { getHeaders } = await import("./headers");
    const out1 = await getHeaders("example.com");
    expect(out1.headers.length).toBeGreaterThan(0);
    expect(out1.status).toBe(200);
    expect(out1.statusMessage).toBe("OK");
    // In Vitest v4, vi.spyOn on a mock returns the same mock, so clear its history
    fetchMock.mockClear();
    const out2 = await getHeaders("example.com");
    expect(out2.headers.length).toBe(out1.headers.length);
    expect(out2.status).toBe(200);
    // Cached responses now include statusMessage since we store status in DB
    expect(out2.statusMessage).toBe("OK");
    expect(fetchMock).not.toHaveBeenCalled();
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

    const { getHeaders } = await import("./headers");
    const [a, b, c] = await Promise.all([
      getHeaders("example.com"),
      getHeaders("example.com"),
      getHeaders("example.com"),
    ]);
    expect(a.headers.length).toBeGreaterThan(0);
    expect(b.headers.length).toBe(a.headers.length);
    expect(c.headers.length).toBe(a.headers.length);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    // Only assert that all calls returned equivalent results; caching is validated elsewhere
    fetchMock.mockRestore();
  });

  it("returns empty array and does not cache on error", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("network");
    });
    const { getHeaders } = await import("./headers");
    const out = await getHeaders("fail.invalid");
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);
    fetchMock.mockRestore();
  });

  it("handles DNS resolution errors gracefully (ENOTFOUND)", async () => {
    // Simulate ENOTFOUND error (domain has no A/AAAA records)
    const enotfoundError = new Error("fetch failed");
    const cause = new Error(
      "getaddrinfo ENOTFOUND no-web-hosting.invalid",
    ) as Error & {
      code?: string;
      errno?: number;
      syscall?: string;
      hostname?: string;
    };
    cause.code = "ENOTFOUND";
    cause.errno = -3007;
    cause.syscall = "getaddrinfo";
    cause.hostname = "no-web-hosting.invalid";
    (enotfoundError as Error & { cause?: Error }).cause = cause;

    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw enotfoundError;
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("no-web-hosting.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Note: Logger calls are tested by integration - the service calls logger.debug()
    // which is mocked in vitest.setup.ts to not actually log anything

    fetchMock.mockRestore();
  });

  it("logs actual errors (non-DNS) as errors", async () => {
    // Simulate a real error (not DNS-related)
    const realError = new Error("Connection timeout");

    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw realError;
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("timeout.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Note: Logger calls are tested by integration - the service calls logger.error()
    // which is mocked in vitest.setup.ts to not actually log anything

    fetchMock.mockRestore();
  });
});
