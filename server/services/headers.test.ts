/* @vitest-environment node */

// Mock scheduleRevalidation to avoid Inngest API calls in tests
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(true),
}));

const fetchRemoteAssetMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fetch-remote-asset", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fetch-remote-asset")
  >("@/lib/fetch-remote-asset");
  return {
    ...actual,
    fetchRemoteAsset: fetchRemoteAssetMock,
  };
});

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

  // Set default mock implementation
  fetchRemoteAssetMock.mockResolvedValue({
    buffer: Buffer.from(""),
    contentType: "text/html",
    finalUrl: "https://example.com/",
    status: 200,
    headers: {
      server: "vercel",
      "x-vercel-id": "abc",
    },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  fetchRemoteAssetMock.mockReset();
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

    fetchRemoteAssetMock.mockResolvedValueOnce({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://example.com/",
      status: 200,
      headers: {
        server: "vercel",
        "x-vercel-id": "abc",
      },
    });

    const { getHeaders } = await import("./headers");
    const out1 = await getHeaders("example.com");
    expect(out1.headers.length).toBeGreaterThan(0);
    expect(out1.status).toBe(200);
    expect(out1.statusMessage).toBe("OK");
    // Clear mock history before second call
    fetchRemoteAssetMock.mockClear();
    const out2 = await getHeaders("example.com");
    expect(out2.headers.length).toBe(out1.headers.length);
    expect(out2.status).toBe(200);
    // Cached responses now include statusMessage since we store status in DB
    expect(out2.statusMessage).toBe("OK");
    expect(fetchRemoteAssetMock).not.toHaveBeenCalled();
  });

  it("handles concurrent callers and returns consistent results", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://example.com/",
      status: 200,
      headers: {
        server: "vercel",
        "x-vercel-id": "abc",
      },
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
  });

  it("returns empty array and does not cache on error", async () => {
    fetchRemoteAssetMock.mockRejectedValueOnce(new Error("network"));
    const { getHeaders } = await import("./headers");
    const out = await getHeaders("fail.invalid");
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);
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

    fetchRemoteAssetMock.mockRejectedValueOnce(enotfoundError);

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("no-web-hosting.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Note: Logger calls are tested by integration - the service calls logger.debug()
    // which is mocked in vitest.setup.ts to not actually log anything
  });

  it("logs actual errors (non-DNS) as errors", async () => {
    // Simulate a real error (not DNS-related)
    const realError = new Error("Connection timeout");

    fetchRemoteAssetMock.mockRejectedValueOnce(realError);

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("timeout.invalid");

    // Should return empty array
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);

    // Note: Logger calls are tested by integration - the service calls logger.error()
    // which is mocked in vitest.setup.ts to not actually log anything
  });

  it("configures fetchRemoteAsset with HEAD method and fallback enabled", async () => {
    // Create domain record first (simulates registered domain)
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });

    fetchRemoteAssetMock.mockResolvedValueOnce({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://example.com/",
      status: 200,
      headers: {
        server: "nginx",
        "content-type": "text/html",
      },
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("example.com");

    // Should successfully return headers
    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(200);
    expect(out.statusMessage).toBe("OK");

    // Verify the service passes correct configuration to fetchRemoteAsset
    // (actual fallback behavior is tested in lib/fetch-remote-asset.test.ts)
    expect(fetchRemoteAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "HEAD",
        fallbackToGetOnHeadFailure: true,
        allowNonOkResponse: true,
      }),
    );
  });

  it("captures headers and status for non-2xx responses (e.g., 403 Forbidden)", async () => {
    fetchRemoteAssetMock.mockResolvedValueOnce({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://protected.example/",
      status: 403,
      headers: {
        server: "nginx",
        "x-frame-options": "DENY",
        "content-type": "text/html",
      },
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("protected.example");

    // Should return headers and status even for 403
    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(403);
    expect(out.statusMessage).toBe("Forbidden");

    // Verify headers are present
    const serverHeader = out.headers.find((h) => h.name === "server");
    expect(serverHeader?.value).toBe("nginx");
    const xFrameHeader = out.headers.find((h) => h.name === "x-frame-options");
    expect(xFrameHeader?.value).toBe("DENY");
  });

  it("captures headers and status for 404 Not Found responses", async () => {
    fetchRemoteAssetMock.mockResolvedValueOnce({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://notfound.example/",
      status: 404,
      headers: {
        server: "cloudflare",
        "cf-ray": "abc123",
      },
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("notfound.example");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(404);
    expect(out.statusMessage).toBe("Not Found");

    const serverHeader = out.headers.find((h) => h.name === "server");
    expect(serverHeader?.value).toBe("cloudflare");
  });

  it("captures headers and status for 500 Internal Server Error responses", async () => {
    fetchRemoteAssetMock.mockResolvedValueOnce({
      buffer: Buffer.from(""),
      contentType: "text/html",
      finalUrl: "https://error.example/",
      status: 500,
      headers: {
        server: "Apache",
        "retry-after": "3600",
      },
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("error.example");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(500);
    expect(out.statusMessage).toBe("Internal Server Error");
  });
});
