/* @vitest-environment node */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock toRegistrableDomain to allow .invalid and .example domains for testing
vi.mock("@/lib/domain-server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domain-server")>(
    "@/lib/domain-server",
  );
  return {
    ...actual,
    toRegistrableDomain: (input: string) => {
      // Allow .invalid and .example domains (reserved, never resolve) for safe testing
      if (input.endsWith(".invalid") || input.endsWith(".example")) {
        return input.toLowerCase();
      }
      // Use real implementation for everything else
      return actual.toRegistrableDomain(input);
    },
  };
});

const storageMock = vi.hoisted(() => ({
  storeImage: vi.fn(async () => ({
    url: "https://test-store.public.blob.vercel-storage.com/abcdef0123456789abcdef0123456789/32x32.webp",
    pathname: "abcdef0123456789abcdef0123456789/32x32.webp",
  })),
  getFaviconTtlSeconds: vi.fn(() => 60),
}));

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
  const { makeInMemoryRedis } = await import("@/lib/redis-mock");
  const impl = makeInMemoryRedis();
  vi.doMock("@/lib/redis", () => impl);
});

// Import after mocks
let getOrCreateFaviconBlobUrl: typeof import("./favicon").getOrCreateFaviconBlobUrl;
beforeAll(async () => {
  ({ getOrCreateFaviconBlobUrl } = await import("./favicon"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  storageMock.storeImage.mockReset();
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

describe("getOrCreateFaviconBlobUrl", () => {
  it("returns existing blob url from DB when present", async () => {
    const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
    const { upsertFavicon } = await import("@/lib/db/repos/favicons");

    const domainRecord = await ensureDomainRecord("example.com");
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

    const out = await getOrCreateFaviconBlobUrl("example.com");
    expect(out.url).toBe("blob://existing-url");
    expect(storageMock.storeImage).not.toHaveBeenCalled();
  });

  it("fetches, converts, stores, and returns url when not cached", async () => {
    const body = new Uint8Array([137, 80, 78, 71]); // pretend PNG signature bytes
    const resp = new Response(body, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(resp);

    const out = await getOrCreateFaviconBlobUrl("example.com");
    expect(out.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/32x32\.webp$/,
    );
    expect(storageMock.storeImage).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when all sources fail", async () => {
    const notOk = new Response(null, { status: 404 });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(notOk);
    const out = await getOrCreateFaviconBlobUrl("nope.invalid");
    expect(out.url).toBeNull();
    fetchSpy.mockRestore();
  });

  it("negative-caches failures to avoid repeat fetch", async () => {
    const notOk = new Response(null, { status: 404 });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(notOk);

    // First call: miss -> fetch attempts -> negative cache
    const first = await getOrCreateFaviconBlobUrl("negcache.example");
    expect(first.url).toBeNull();
    expect(fetchSpy).toHaveBeenCalled();

    // Second call: should hit negative cache and not fetch again
    fetchSpy.mockClear();
    const second = await getOrCreateFaviconBlobUrl("negcache.example");
    expect(second.url).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
