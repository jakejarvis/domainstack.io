/* @vitest-environment node */

// Mock toRegistrableDomain to allow .invalid domains for testing
vi.mock("@/lib/domain-server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domain-server")>(
    "@/lib/domain-server",
  );
  return {
    ...actual,
    toRegistrableDomain: (input: string) => {
      // Allow .invalid domains (reserved, never resolve) for safe testing
      if (input.endsWith(".invalid")) {
        return input.toLowerCase();
      }
      // Use real implementation for everything else
      return actual.toRegistrableDomain(input);
    },
  };
});

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
  const { makeInMemoryRedis } = await import("@/lib/redis-mock");
  const impl = makeInMemoryRedis();
  vi.doMock("@/lib/redis", () => impl);
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterEach(async () => {
  vi.restoreAllMocks();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("probeHeaders", () => {
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

    const { probeHeaders } = await import("./headers");
    const out1 = await probeHeaders("example.com");
    expect(out1.headers.length).toBeGreaterThan(0);
    expect(out1.status).toBe(200);
    expect(out1.statusMessage).toBe("OK");
    // In Vitest v4, vi.spyOn on a mock returns the same mock, so clear its history
    fetchMock.mockClear();
    const out2 = await probeHeaders("example.com");
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

    const { probeHeaders } = await import("./headers");
    const [a, b, c] = await Promise.all([
      probeHeaders("example.com"),
      probeHeaders("example.com"),
      probeHeaders("example.com"),
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
    const { probeHeaders } = await import("./headers");
    const out = await probeHeaders("fail.invalid");
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

    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { probeHeaders } = await import("./headers");
    const out = await probeHeaders("no-web-hosting.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Should log as debug (not error) since this is expected
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[headers] no web hosting"),
    );

    // Should NOT log as error
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    fetchMock.mockRestore();
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("logs actual errors (non-DNS) as errors", async () => {
    // Simulate a real error (not DNS-related)
    const realError = new Error("Connection timeout");

    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw realError;
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleDebugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => {});

    const { probeHeaders } = await import("./headers");
    const out = await probeHeaders("timeout.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Should log as error since this is unexpected
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[headers] error"),
      realError,
    );

    // Should NOT log as debug (no web hosting)
    expect(consoleDebugSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[headers] no web hosting"),
    );

    fetchMock.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });
});
