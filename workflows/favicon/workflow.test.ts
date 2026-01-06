/* @vitest-environment node */
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

// Mock storage
const storageMock = vi.hoisted(() => ({
  storeImage: vi.fn().mockResolvedValue({
    url: "https://blob.vercel-storage.com/favicon.webp",
    pathname: "favicon.webp",
  }),
}));

vi.mock("@/lib/storage", () => storageMock);
vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

// Mock sharp for image processing
vi.mock("sharp", () => ({
  default: (_input: unknown, _opts?: unknown) => ({
    resize: () => ({
      webp: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
    }),
  }),
}));

// Mock fetch-remote-asset
const fetchRemoteAssetMock = vi.hoisted(() => ({
  fetchRemoteAsset: vi.fn(),
  RemoteAssetError: class RemoteAssetError extends Error {},
}));

vi.mock("@/lib/fetch-remote-asset", () => fetchRemoteAssetMock);

// Mock icon sources
vi.mock("@/lib/icons/sources", () => ({
  buildIconSources: vi.fn().mockReturnValue([
    { name: "direct-favicon", url: "https://example.com/favicon.ico" },
    {
      name: "duckduckgo",
      url: "https://icons.duckduckgo.com/ip3/example.com.ico",
    },
  ]),
}));

describe("faviconWorkflow step functions", () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  describe("checkCache step", () => {
    it("returns cached favicon when present", async () => {
      const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
      const { upsertFavicon } = await import("@/lib/db/repos/favicons");

      const domain = await ensureDomainRecord("cached-favicon.com");
      await upsertFavicon({
        domainId: domain.id,
        url: "https://cached-favicon.webp",
        pathname: null,
        size: 32,
        source: "direct",
        notFound: false,
        upstreamStatus: 200,
        upstreamContentType: "image/webp",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "cached-favicon.com" });

      expect(result.cached).toBe(true);
      expect(result.url).toBe("https://cached-favicon.webp");
      expect(result.notFound).toBe(false);
    });

    it("returns cached notFound status", async () => {
      const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
      const { upsertFavicon } = await import("@/lib/db/repos/favicons");

      const domain = await ensureDomainRecord("no-favicon.com");
      await upsertFavicon({
        domainId: domain.id,
        url: null,
        pathname: null,
        size: 32,
        source: null,
        notFound: true,
        upstreamStatus: null,
        upstreamContentType: null,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "no-favicon.com" });

      expect(result.cached).toBe(true);
      expect(result.url).toBeNull();
      expect(result.notFound).toBe(true);
    });
  });

  describe("fetchFromSources step", () => {
    it("fetches favicon from first successful source", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: true,
        status: 200,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG magic bytes
        contentType: "image/png",
      });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "fresh-favicon.com" });

      expect(result.cached).toBe(false);
      expect(result.url).toBe("https://blob.vercel-storage.com/favicon.webp");
      expect(result.notFound).toBe(false);
    });

    it("tries fallback sources when first fails", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          contentType: "image/png",
        });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "fallback-favicon.com" });

      expect(result.url).toBe("https://blob.vercel-storage.com/favicon.webp");
      expect(fetchRemoteAssetMock.fetchRemoteAsset).toHaveBeenCalledTimes(2);
    });

    it("returns notFound when all sources return 404", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "missing-favicon.com" });

      expect(result.url).toBeNull();
      expect(result.notFound).toBe(true);
    });
  });

  describe("processImage step", () => {
    it("converts image to WebP", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: true,
        status: 200,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: "image/png",
      });

      const { faviconWorkflow } = await import("./workflow");
      const result = await faviconWorkflow({ domain: "convert-favicon.com" });

      expect(result.url).toContain(".webp");
    });
  });

  describe("storeAndPersist step", () => {
    it("stores favicon and persists to database", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: true,
        status: 200,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: "image/png",
      });

      const { faviconWorkflow } = await import("./workflow");
      await faviconWorkflow({ domain: "store-favicon.com" });

      // Verify storage was called
      expect(storageMock.storeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "favicon",
          domain: "store-favicon.com",
        }),
      );

      // Verify database was updated
      const { getFaviconByDomain } = await import("@/lib/db/repos/favicons");
      const cached = await getFaviconByDomain("store-favicon.com");
      expect(cached).not.toBeNull();
      expect(cached?.url).toBe("https://blob.vercel-storage.com/favicon.webp");
    });
  });

  describe("persistFailure step", () => {
    it("persists failure to database", async () => {
      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { faviconWorkflow } = await import("./workflow");
      await faviconWorkflow({ domain: "failed-favicon.com" });

      const { getFaviconByDomain } = await import("@/lib/db/repos/favicons");
      const cached = await getFaviconByDomain("failed-favicon.com");
      expect(cached).not.toBeNull();
      expect(cached?.url).toBeNull();
      expect(cached?.notFound).toBe(true);
    });
  });
});
