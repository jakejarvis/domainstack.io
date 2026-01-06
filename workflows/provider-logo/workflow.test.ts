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
    url: "https://blob.vercel-storage.com/provider-logo.webp",
    pathname: "provider-logo.webp",
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
    { name: "logo-dev", url: "https://img.logo.dev/cloudflare.com" },
    { name: "direct-favicon", url: "https://cloudflare.com/favicon.ico" },
  ]),
}));

// Test UUIDs for provider IDs (must be valid UUID v4 format)
const TEST_PROVIDER_IDS = {
  cached: "11111111-1111-4111-a111-111111111111",
  missing: "22222222-2222-4222-a222-222222222222",
  fresh: "33333333-3333-4333-a333-333333333333",
  fallback: "44444444-4444-4444-a444-444444444444",
  noLogo: "55555555-5555-4555-a555-555555555555",
  store: "66666666-6666-4666-a666-666666666666",
  fail: "77777777-7777-4777-a777-777777777777",
};

// Helper to create a provider record before testing logos
async function createTestProvider(
  providerId: string,
  providerDomain: string,
): Promise<void> {
  const { db } = await import("@/lib/db/client");
  const { providers } = await import("@/lib/db/schema");

  const slug = providerDomain.replace(/\./g, "-");
  await db.insert(providers).values({
    id: providerId,
    name: `Test Provider ${providerId.slice(0, 8)}`,
    domain: providerDomain,
    category: "registrar",
    slug,
  });
}

describe("providerLogoWorkflow step functions", () => {
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
    it("returns cached provider logo when present", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.cached, "cloudflare.com");

      const { upsertProviderLogo } = await import(
        "@/lib/db/repos/provider-logos"
      );

      await upsertProviderLogo({
        providerId: TEST_PROVIDER_IDS.cached,
        url: "https://cached-logo.webp",
        pathname: "cached.webp",
        size: 64,
        source: "logo-dev",
        notFound: false,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { providerLogoWorkflow } = await import("./workflow");
      const result = await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.cached,
        providerDomain: "cloudflare.com",
      });

      expect(result.cached).toBe(true);
      expect(result.url).toBe("https://cached-logo.webp");
      expect(result.notFound).toBe(false);
    });

    it("returns cached notFound status", async () => {
      await createTestProvider(
        TEST_PROVIDER_IDS.missing,
        "unknown-provider.com",
      );

      const { upsertProviderLogo } = await import(
        "@/lib/db/repos/provider-logos"
      );

      await upsertProviderLogo({
        providerId: TEST_PROVIDER_IDS.missing,
        url: null,
        pathname: null,
        size: 64,
        source: null,
        notFound: true,
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { providerLogoWorkflow } = await import("./workflow");
      const result = await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.missing,
        providerDomain: "unknown-provider.com",
      });

      expect(result.cached).toBe(true);
      expect(result.url).toBeNull();
      expect(result.notFound).toBe(true);
    });
  });

  describe("fetchFromSources step", () => {
    it("fetches logo from first successful source", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.fresh, "newprovider.com");

      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: true,
        status: 200,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: "image/png",
      });

      const { providerLogoWorkflow } = await import("./workflow");
      const result = await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.fresh,
        providerDomain: "newprovider.com",
      });

      expect(result.cached).toBe(false);
      expect(result.url).toBe(
        "https://blob.vercel-storage.com/provider-logo.webp",
      );
      expect(result.notFound).toBe(false);
    });

    it("tries fallback sources when first fails", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.fallback, "fallback.com");

      fetchRemoteAssetMock.fetchRemoteAsset
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          contentType: "image/png",
        });

      const { providerLogoWorkflow } = await import("./workflow");
      const result = await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.fallback,
        providerDomain: "fallback.com",
      });

      expect(result.url).toBe(
        "https://blob.vercel-storage.com/provider-logo.webp",
      );
      expect(fetchRemoteAssetMock.fetchRemoteAsset).toHaveBeenCalledTimes(2);
    });

    it("returns notFound when all sources return 404", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.noLogo, "no-logo.com");

      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { providerLogoWorkflow } = await import("./workflow");
      const result = await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.noLogo,
        providerDomain: "no-logo.com",
      });

      expect(result.url).toBeNull();
      expect(result.notFound).toBe(true);
    });
  });

  describe("storeAndPersist step", () => {
    it("stores logo and persists to database", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.store, "store.com");

      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: true,
        status: 200,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: "image/png",
      });

      const { providerLogoWorkflow } = await import("./workflow");
      await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.store,
        providerDomain: "store.com",
      });

      expect(storageMock.storeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "provider-logo",
          domain: "store.com",
        }),
      );

      // Verify database was updated
      const { getProviderLogoByProviderId } = await import(
        "@/lib/db/repos/provider-logos"
      );
      const cached = await getProviderLogoByProviderId(TEST_PROVIDER_IDS.store);
      expect(cached).not.toBeNull();
      expect(cached?.url).toBe(
        "https://blob.vercel-storage.com/provider-logo.webp",
      );
    });
  });

  describe("persistFailure step", () => {
    it("persists failure to database", async () => {
      await createTestProvider(TEST_PROVIDER_IDS.fail, "fail.com");

      fetchRemoteAssetMock.fetchRemoteAsset.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { providerLogoWorkflow } = await import("./workflow");
      await providerLogoWorkflow({
        providerId: TEST_PROVIDER_IDS.fail,
        providerDomain: "fail.com",
      });

      const { getProviderLogoByProviderId } = await import(
        "@/lib/db/repos/provider-logos"
      );
      const cached = await getProviderLogoByProviderId(TEST_PROVIDER_IDS.fail);
      expect(cached).not.toBeNull();
      expect(cached?.url).toBeNull();
      expect(cached?.notFound).toBe(true);
    });
  });
});
