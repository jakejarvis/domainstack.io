/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "@/mocks/server";

const storageMock = vi.hoisted(() => ({
  storeImage: vi.fn(async () => ({
    url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/32x32.webp",
    pathname: "abcdef0123456789abcdef0123456789/32x32.webp",
  })),
  getFaviconTtlSeconds: vi.fn(() => 60),
}));

// We rely on MSW for DNS lookups now (via handlers.ts)
// No need to mock @/lib/dns-lookup unless we want to force specific behavior not covered by MSW handlers

vi.mock("@/lib/storage", () => storageMock);
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

// Mock sharp to return a pipeline that resolves a buffer (now using webp)
vi.mock("sharp", () => ({
  default: (_input: unknown, _opts?: unknown) => ({
    resize: () => ({
      webp: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
    }),
  }),
}));

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
});

// Import after mocks
let getFavicon: typeof import("./favicon").getFavicon;
beforeAll(async () => {
  ({ getFavicon } = await import("./favicon"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
  storageMock.storeImage.mockReset();
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("getFavicon", () => {
  it("returns existing blob url from DB when present", async () => {
    const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
    const { upsertFavicon } = await import("@/lib/db/repos/favicons");

    const domainRecord = await ensureDomainRecord("verified-dns.test");
    await upsertFavicon({
      domainId: domainRecord.id,
      url: "blob://existing-url",
      pathname: null,
      size: 32,
      source: null,
      notFound: false,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000000),
    });

    const out = await getFavicon("verified-dns.test");
    expect(out.url).toBe("blob://existing-url");
    expect(storageMock.storeImage).not.toHaveBeenCalled();
  });

  it("fetches, converts, stores, and returns url when not cached", async () => {
    // verified-dns.test resolves via MSW handlers.ts
    const out = await getFavicon("verified-dns.test");
    expect(out.url).toMatch(
      /^https:\/\/test-store\.public\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/32x32\.webp$/,
    );
    expect(storageMock.storeImage).toHaveBeenCalled();
  }, 10000);

  it("returns null when all sources fail with 404", async () => {
    // nxdomain.test is now in handlers.ts for DNS
    // We override the HTTP responses to return 404
    server.use(
      http.get("http://nxdomain.test/*", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
      http.get("https://nxdomain.test/*", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
      // Also fail fallbacks
      http.get("https://icons.duckduckgo.com/ip3/nxdomain.test.ico", () => {
        return HttpResponse.json({}, { status: 404 });
      }),
      http.get("https://www.google.com/s2/favicons", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("domain") === "nxdomain.test") {
          return HttpResponse.json({}, { status: 404 });
        }
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const out = await getFavicon("nxdomain.test");
    expect(out.url).toBeNull();
  }, 10000);

  it("negative-caches 404 failures to avoid repeat fetch", async () => {
    // negcache.test is now in handlers.ts for DNS
    // Force 404 for negcache.test and fallback providers
    let callCount = 0;
    server.use(
      http.get("http://negcache.test/*", () => {
        callCount++;
        return HttpResponse.json({}, { status: 404 });
      }),
      http.get("https://negcache.test/*", () => {
        callCount++;
        return HttpResponse.json({}, { status: 404 });
      }),
      http.get("https://icons.duckduckgo.com/ip3/negcache.test.ico", () => {
        return HttpResponse.json({}, { status: 404 });
      }),
      http.get("https://www.google.com/s2/favicons", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("domain") === "negcache.test") {
          return HttpResponse.json({}, { status: 404 });
        }
        return HttpResponse.json({}, { status: 200 }); // Default for others
      }),
    );

    // First call: miss -> fetch attempts -> negative cache
    const first = await getFavicon("negcache.test");
    expect(first.url).toBeNull();
    // It should have tried multiple URLs
    expect(callCount).toBeGreaterThan(0);
    const callsAfterFirst = callCount;

    // Second call: should hit negative cache and not fetch again
    const second = await getFavicon("negcache.test");
    expect(second.url).toBeNull();
    expect(callCount).toBe(callsAfterFirst); // No new network calls
  }, 10000);
});
