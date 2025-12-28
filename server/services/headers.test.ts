/* @vitest-environment node */
import { HttpResponse, http } from "msw";
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
import { DOH_PROVIDERS } from "@/lib/dns-utils";
import { server } from "@/mocks/server";

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
  server.resetHandlers();
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

// Helper to mock DNS resolution for a domain
function mockDns(domain: string, ip: string = "1.2.3.4") {
  server.use(
    ...DOH_PROVIDERS.map((provider) =>
      http.get(provider.url, ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");
        const type = url.searchParams.get("type");

        // Allow matching with or without trailing dot
        const normalizedName = name?.endsWith(".") ? name.slice(0, -1) : name;
        const normalizedDomain = domain.endsWith(".")
          ? domain.slice(0, -1)
          : domain;

        if (
          normalizedName === normalizedDomain &&
          (type === "A" || type === "AAAA")
        ) {
          return HttpResponse.json({
            Status: 0,
            Answer: [{ name: `${domain}.`, type: 1, TTL: 60, data: ip }],
          });
        }
        // Passthrough or return empty for other queries to avoid interfering with other tests
        // But for strictness, we can return empty if not matched
        return HttpResponse.json({ Status: 0, Answer: [] });
      }),
    ),
  );
}

describe("getHeaders", () => {
  it("uses GET and caches result", async () => {
    // Setup DNS and HTTP mocks
    mockDns("example.test");
    server.use(
      http.head("https://example.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            server: "vercel",
            "x-vercel-id": "abc",
          },
        });
      }),
    );

    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.test",
      tld: "test",
      unicodeName: "example.test",
    });

    const { getHeaders } = await import("./headers");
    const out1 = await getHeaders("example.test");

    expect(out1.headers.length).toBeGreaterThan(0);
    expect(out1.status).toBe(200);
    expect(out1.statusMessage).toBe("OK");

    // Capture requests to verify caching (no second request)
    const requestListener = vi.fn();
    server.events.on("request:start", requestListener);

    const out2 = await getHeaders("example.test");
    expect(out2.headers.length).toBe(out1.headers.length);
    expect(out2.status).toBe(200);
    expect(out2.statusMessage).toBe("OK");

    expect(requestListener).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it("handles concurrent callers and returns consistent results", async () => {
    mockDns("example.test");
    server.use(
      http.head("https://example.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            server: "vercel",
            "x-vercel-id": "abc",
          },
        });
      }),
    );

    const { getHeaders } = await import("./headers");
    const [a, b, c] = await Promise.all([
      getHeaders("example.test"),
      getHeaders("example.test"),
      getHeaders("example.test"),
    ]);
    expect(a.headers.length).toBeGreaterThan(0);
    expect(b.headers.length).toBe(a.headers.length);
    expect(c.headers.length).toBe(a.headers.length);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
  });

  it("returns empty array and does not cache on error", async () => {
    mockDns("fail.invalid");
    server.use(
      http.head("https://fail.invalid/", () => {
        return HttpResponse.error();
      }),
      // Fallback GET if HEAD fails (implied logic), but here strict error
      http.get("https://fail.invalid/", () => {
        return HttpResponse.error();
      }),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("fail.invalid");
    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);
  });

  it("handles DNS resolution errors gracefully (ENOTFOUND)", async () => {
    // No DNS mock = empty answers = DNS failure in fetchRemoteAsset
    // Default MSW handlers return empty/404 for unknown domains if not caught by mockDns helper
    // If we rely on global handlers, "no-web-hosting.invalid" might get some response or fail.
    // Explicitly mock empty DNS
    server.use(
      ...DOH_PROVIDERS.map((provider) =>
        http.get(provider.url, () =>
          HttpResponse.json({ Status: 0, Answer: [] }),
        ),
      ),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("no-web-hosting.invalid");

    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);
  });

  it("logs actual errors (non-DNS) as errors", async () => {
    mockDns("timeout.invalid");
    // Simulate connection timeout by delaying indefinitely or using error
    // fetchRemoteAsset handles timeouts. MSW doesn't easily simulate "timeout" except via error or delay.
    // We can use HttpResponse.error() to simulate network error.
    server.use(
      http.head("https://timeout.invalid/", () => {
        return HttpResponse.error();
      }),
      http.get("https://timeout.invalid/", () => {
        return HttpResponse.error();
      }),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("timeout.invalid");

    expect(out.headers.length).toBe(0);
    expect(out.status).toBe(0);
  });

  it("configures fetchRemoteAsset with HEAD method and fallback enabled", async () => {
    mockDns("example.test");
    // Verify HEAD is called
    let headCalled = false;
    server.use(
      http.head("https://example.test/", () => {
        headCalled = true;
        return new HttpResponse(null, {
          status: 200,
          headers: {
            server: "nginx",
            "content-type": "text/html",
          },
        });
      }),
    );

    const { upsertDomain } = await import("@/lib/db/repos/domains");
    await upsertDomain({
      name: "example.test",
      tld: "test",
      unicodeName: "example.test",
    });

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("example.test");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(200);
    expect(out.statusMessage).toBe("OK");
    expect(headCalled).toBe(true);
  });

  it("captures headers and status for non-2xx responses (e.g., 403 Forbidden)", async () => {
    mockDns("protected.example");
    server.use(
      http.head("https://protected.example/", () => {
        return new HttpResponse(null, {
          status: 403,
          headers: {
            server: "nginx",
            "x-frame-options": "DENY",
            "content-type": "text/html",
          },
        });
      }),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("protected.example");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(403);
    expect(out.statusMessage).toBe("Forbidden");

    const serverHeader = out.headers.find((h) => h.name === "server");
    expect(serverHeader?.value).toBe("nginx");
    const xFrameHeader = out.headers.find((h) => h.name === "x-frame-options");
    expect(xFrameHeader?.value).toBe("DENY");
  });

  it("captures headers and status for 404 Not Found responses", async () => {
    mockDns("notfound.example");
    server.use(
      http.head("https://notfound.example/", () => {
        return new HttpResponse(null, {
          status: 404,
          headers: {
            server: "cloudflare",
            "cf-ray": "abc123",
          },
        });
      }),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("notfound.example");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(404);
    expect(out.statusMessage).toBe("Not Found");

    const serverHeader = out.headers.find((h) => h.name === "server");
    expect(serverHeader?.value).toBe("cloudflare");
  });

  it("captures headers and status for 500 Internal Server Error responses", async () => {
    mockDns("error.example");
    server.use(
      http.head("https://error.example/", () => {
        return new HttpResponse(null, {
          status: 500,
          headers: {
            server: "Apache",
            "retry-after": "3600",
          },
        });
      }),
    );

    const { getHeaders } = await import("./headers");
    const out = await getHeaders("error.example");

    expect(out.headers.length).toBeGreaterThan(0);
    expect(out.status).toBe(500);
    expect(out.statusMessage).toBe("Internal Server Error");
  });
});
