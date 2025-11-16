/* @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { RemoteAssetError } from "@/lib/fetch-remote-asset";

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

const fetchRemoteAssetMock = vi.hoisted(() =>
  // Shared stub so we can flip between success + failure scenarios quickly.
  vi.fn(async () => ({
    buffer: Buffer.from([1, 2, 3, 4]),
    contentType: "image/png",
    finalUrl: "https://example.com/favicon.ico",
    status: 200,
  })),
);

vi.mock("@/lib/storage", () => storageMock);
vi.mock("@/lib/fetch-remote-asset", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fetch-remote-asset")
  >("@/lib/fetch-remote-asset");
  return {
    ...actual,
    fetchRemoteAsset: fetchRemoteAssetMock,
  };
});
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
  fetchRemoteAssetMock.mockReset();
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
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
    const out = await getOrCreateFaviconBlobUrl("example.com");
    expect(out.url).toMatch(
      /^https:\/\/.*\.blob\.vercel-storage\.com\/[a-f0-9]{32}\/32x32\.webp$/,
    );
    expect(fetchRemoteAssetMock).toHaveBeenCalled();
    expect(storageMock.storeImage).toHaveBeenCalled();
  }, 10000); // 10s timeout for network + image processing

  it("returns null when all sources fail", async () => {
    fetchRemoteAssetMock.mockRejectedValue(
      new RemoteAssetError("response_error", "Not found", 404),
    );
    const out = await getOrCreateFaviconBlobUrl("nope.invalid");
    expect(out.url).toBeNull();
    expect(fetchRemoteAssetMock).toHaveBeenCalled();
  }, 10000); // 10s timeout for multiple fetch attempts

  it("negative-caches failures to avoid repeat fetch", async () => {
    fetchRemoteAssetMock.mockRejectedValue(
      new RemoteAssetError("response_error", "Not found", 404),
    );

    // First call: miss -> fetch attempts -> negative cache
    const first = await getOrCreateFaviconBlobUrl("negcache.example");
    expect(first.url).toBeNull();
    expect(fetchRemoteAssetMock).toHaveBeenCalled();

    // Second call: should hit negative cache and not fetch again
    fetchRemoteAssetMock.mockClear();
    const second = await getOrCreateFaviconBlobUrl("negcache.example");
    expect(second.url).toBeNull();
    expect(fetchRemoteAssetMock).not.toHaveBeenCalled();
  }, 10000); // 10s timeout for multiple fetch attempts
});
