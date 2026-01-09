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
import { server } from "@/mocks/server";

// Mock DNS for domain resolution
function mockDns(domain: string) {
  server.use(
    http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (name === domain) {
        return HttpResponse.json({
          Status: 0,
          Answer: [
            {
              name: `${domain}.`,
              type: 1,
              TTL: 60,
              data: "1.2.3.4",
            },
          ],
        });
      }

      return HttpResponse.json({ Status: 0, Answer: [] });
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("fetchHttpHeaders", () => {
  it("fetches headers successfully via HEAD request", async () => {
    mockDns("success.test");
    server.use(
      http.head("https://success.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            server: "vercel",
            "x-vercel-id": "abc123",
          },
        });
      }),
    );

    const { fetchHttpHeaders } = await import("./headers-lookup");
    const result = await fetchHttpHeaders("success.test");

    expect(result.success).toBe(true);
    expect(result.headers.length).toBeGreaterThan(0);
    expect(result.status).toBe(200);
    expect(result.statusMessage).toBe("OK");
  });

  it("captures non-2xx responses correctly", async () => {
    mockDns("forbidden.test");
    server.use(
      http.head("https://forbidden.test/", () => {
        return new HttpResponse(null, {
          status: 403,
          headers: {
            server: "nginx",
            "x-frame-options": "DENY",
          },
        });
      }),
    );

    const { fetchHttpHeaders } = await import("./headers-lookup");
    const result = await fetchHttpHeaders("forbidden.test");

    expect(result.success).toBe(true);
    expect(result.status).toBe(403);
    expect(result.statusMessage).toBe("Forbidden");
  });

  it("returns fetch_error on network error", async () => {
    mockDns("error.test");
    server.use(
      http.head("https://error.test/", () => {
        return HttpResponse.error();
      }),
      http.get("https://error.test/", () => {
        return HttpResponse.error();
      }),
    );

    const { fetchHttpHeaders } = await import("./headers-lookup");
    const result = await fetchHttpHeaders("error.test");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("fetch_error");
    }
  });

  it("normalizes and sorts headers correctly", async () => {
    mockDns("sorted.test");
    server.use(
      http.head("https://sorted.test/", () => {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            "X-Custom": "value",
            Server: "NGINX", // Mixed case
            "Content-Security-Policy": "default-src 'self'", // Important header
            Accept: "text/html",
          },
        });
      }),
    );

    const { fetchHttpHeaders } = await import("./headers-lookup");
    const result = await fetchHttpHeaders("sorted.test");

    expect(result.success).toBe(true);

    // All headers should be lowercase
    const headerNames = result.headers.map((h) => h.name);
    expect(headerNames).toEqual(
      expect.arrayContaining([
        "server",
        "content-security-policy",
        "x-custom",
        "accept",
      ]),
    );

    // Important headers (like content-security-policy) should be first
    const cspIndex = headerNames.indexOf("content-security-policy");
    const serverIndex = headerNames.indexOf("server");
    expect(cspIndex).toBeLessThan(serverIndex);
  });
});

describe("persistHttpHeaders", () => {
  // Setup PGlite for database tests
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  it("persists headers to database", async () => {
    // Mock schedule revalidation for this test
    vi.doMock("@/lib/schedule", () => ({
      scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
    }));

    const { persistHttpHeaders } = await import("./headers-lookup");
    await persistHttpHeaders(
      "persist.test",
      [
        { name: "server", value: "nginx" },
        { name: "content-type", value: "text/html" },
      ],
      200,
    );

    // Verify persistence - domain should have been created
    const { findDomainByName } = await import("@/lib/db/repos/domains");
    const domain = await findDomainByName("persist.test");
    expect(domain).toBeTruthy();

    const { db } = await import("@/lib/db/client");
    const { httpHeaders } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const stored = await db
      .select()
      .from(httpHeaders)
      .where(eq(httpHeaders.domainId, domain?.id))
      .limit(1);

    expect(stored.length).toBe(1);
    expect(stored[0].status).toBe(200);
    expect(stored[0].headers).toEqual([
      { name: "server", value: "nginx" },
      { name: "content-type", value: "text/html" },
    ]);
  });
});
