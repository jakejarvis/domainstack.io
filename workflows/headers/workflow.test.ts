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

// Helper to mock DNS resolution for a domain
function mockDns(domain: string, ip = "1.2.3.4") {
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
        return HttpResponse.json({ Status: 0, Answer: [] });
      }),
    ),
  );
}

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

describe("fetchHeaders", () => {
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

    const { fetchHeaders } = await import("./workflow");
    const result = await fetchHeaders("success.test");

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

    const { fetchHeaders } = await import("./workflow");
    const result = await fetchHeaders("forbidden.test");

    expect(result.success).toBe(true);
    expect(result.status).toBe(403);
    expect(result.statusMessage).toBe("Forbidden");
  });

  it("returns failure on network error", async () => {
    mockDns("error.test");
    server.use(
      http.head("https://error.test/", () => {
        return HttpResponse.error();
      }),
      http.get("https://error.test/", () => {
        return HttpResponse.error();
      }),
    );

    const { fetchHeaders } = await import("./workflow");
    const result = await fetchHeaders("error.test");

    expect(result.success).toBe(false);
    expect(result.headers).toEqual([]);
    expect(result.status).toBe(0);
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

    const { fetchHeaders } = await import("./workflow");
    const result = await fetchHeaders("sorted.test");

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

describe("persistHeaders", () => {
  it("persists headers to database", async () => {
    const { upsertDomain, findDomainByName } = await import(
      "@/lib/db/repos/domains"
    );
    await upsertDomain({
      name: "persist.test",
      tld: "test",
      unicodeName: "persist.test",
    });

    const domain = await findDomainByName("persist.test");
    expect(domain).toBeTruthy();

    const { persistHeaders } = await import("./workflow");
    await persistHeaders(
      domain?.id,
      [
        { name: "server", value: "nginx" },
        { name: "content-type", value: "text/html" },
      ],
      200,
      null,
      "persist.test",
    );

    // Verify persistence
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
