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

// Hoist mocks for external dependencies
const fetchRemoteAssetMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fetch-remote-asset", () => ({
  fetchRemoteAsset: fetchRemoteAssetMock,
}));

// Mock fetch utilities
vi.mock("@/lib/fetch", () => ({
  isExpectedTlsError: vi.fn().mockReturnValue(false),
}));

// Mock schedule revalidation
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(undefined),
}));

// Mock blocked domains
vi.mock("@/lib/db/repos/blocked-domains", () => ({
  isDomainBlocked: vi.fn().mockResolvedValue(false),
}));

// Mock storage
vi.mock("@/lib/storage", () => ({
  storeImage: vi.fn().mockResolvedValue({
    url: "https://blob.vercel-storage.com/og-test.webp",
    pathname: "og/test.webp",
  }),
}));

// Mock image processing
vi.mock("@/lib/image", () => ({
  optimizeImageCover: vi.fn().mockResolvedValue(Buffer.from("optimized")),
}));

describe("seoWorkflow step functions", () => {
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
    it("returns cached SEO data when present and not expired", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertSeo } = await import("@/lib/db/repos/seo");

      const domain = await upsertDomain({
        name: "cached.com",
        tld: "com",
        unicodeName: "cached.com",
      });

      await upsertSeo({
        domainId: domain.id,
        sourceFinalUrl: "https://cached.com/",
        sourceStatus: 200,
        metaOpenGraph: { title: "Cached Title" },
        metaTwitter: {},
        metaGeneral: { title: "Cached Title" },
        previewTitle: "Cached Title",
        previewDescription: "Cached description",
        previewImageUrl: null,
        previewImageUploadedUrl: null,
        canonicalUrl: "https://cached.com/",
        robots: { fetched: true, groups: [], sitemaps: [] },
        robotsSitemaps: [],
        errors: {},
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "cached.com" });

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.data.preview?.title).toBe("Cached Title");
    });

    it("returns cache miss when domain does not exist", async () => {
      // Mock HTML fetch
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Test Page</title>
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://unknown.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "unknown.com" });

      expect(result.cached).toBe(false);
      expect(result.success).toBe(true);
    });

    it("returns cache miss when SEO data is expired", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertSeo } = await import("@/lib/db/repos/seo");

      const domain = await upsertDomain({
        name: "expired.com",
        tld: "com",
        unicodeName: "expired.com",
      });

      await upsertSeo({
        domainId: domain.id,
        sourceFinalUrl: "https://expired.com/",
        sourceStatus: 200,
        metaOpenGraph: {},
        metaTwitter: {},
        metaGeneral: {},
        previewTitle: null,
        previewDescription: null,
        previewImageUrl: null,
        previewImageUploadedUrl: null,
        canonicalUrl: null,
        robots: { fetched: false, groups: [], sitemaps: [] },
        robotsSitemaps: [],
        errors: {},
        fetchedAt: new Date(Date.now() - 172800000),
        expiresAt: new Date(Date.now() - 86400000), // expired yesterday
      });

      // Mock fresh data
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Fresh Content</title>
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://expired.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "expired.com" });

      expect(result.cached).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe("fetchHtml step", () => {
    it("parses HTML meta tags correctly", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Page Title</title>
                <meta name="description" content="Page description">
                <meta property="og:title" content="OG Title">
                <meta property="og:description" content="OG Description">
                <meta property="og:image" content="https://meta.com/image.png">
                <link rel="canonical" href="https://meta.com/">
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://meta.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "meta.com" });

      expect(result.success).toBe(true);
      expect(result.data.meta?.openGraph.title).toBe("OG Title");
      expect(result.data.meta?.openGraph.description).toBe("OG Description");
      expect(result.data.meta?.general.description).toBe("Page description");
      expect(result.data.preview?.title).toBe("OG Title");
    });

    it("handles non-HTML content type", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "application/json",
          buffer: Buffer.from("{}"),
          finalUrl: url,
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "json.com" });

      expect(result.success).toBe(true);
      expect(result.data.errors?.html).toContain("Non-HTML content-type");
    });

    it("handles HTTP errors", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: false,
            status: 404,
            contentType: "text/plain",
            buffer: Buffer.from("Not Found"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          contentType: "text/html",
          buffer: Buffer.from("Internal Server Error"),
          finalUrl: url,
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "error.com" });

      expect(result.success).toBe(true);
      expect(result.data.errors?.html).toBe("HTTP 500");
    });
  });

  describe("fetchRobots step", () => {
    it("parses robots.txt correctly", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from(`
User-agent: *
Allow: /
Disallow: /private/

Sitemap: https://robots.com/sitemap.xml
            `),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(
            "<html><head><title>Test</title></head><body></body></html>",
          ),
          finalUrl: "https://robots.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "robots.com" });

      expect(result.success).toBe(true);
      expect(result.data.robots?.fetched).toBe(true);
      expect(result.data.robots?.sitemaps).toContain(
        "https://robots.com/sitemap.xml",
      );
    });

    it("handles missing robots.txt", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: false,
            status: 404,
            contentType: "text/plain",
            buffer: Buffer.from("Not Found"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(
            "<html><head><title>Test</title></head><body></body></html>",
          ),
          finalUrl: "https://norobots.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "norobots.com" });

      expect(result.success).toBe(true);
      expect(result.data.robots).toBeNull();
      expect(result.data.errors?.robots).toBe("HTTP 404");
    });
  });

  describe("processOgImage step", () => {
    it("downloads and stores OG image", async () => {
      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        if (url.includes("og-image.png")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "image/png",
            buffer: Buffer.from("fake-image-data"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>OG Image Test</title>
                <meta property="og:image" content="https://ogimage.com/og-image.png">
                <link rel="canonical" href="https://ogimage.com/">
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://ogimage.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "ogimage.com" });

      expect(result.success).toBe(true);
      expect(result.data.preview?.imageUploaded).toBe(
        "https://blob.vercel-storage.com/og-test.webp",
      );
    });

    it("skips OG image for blocked domains", async () => {
      const { isDomainBlocked } = await import(
        "@/lib/db/repos/blocked-domains"
      );
      vi.mocked(isDomainBlocked).mockResolvedValue(true);

      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Blocked Test</title>
                <meta property="og:image" content="https://blocked.com/og-image.png">
                <link rel="canonical" href="https://blocked.com/">
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://blocked.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      const result = await seoWorkflow({ domain: "blocked.com" });

      expect(result.success).toBe(true);
      expect(result.data.preview?.imageUploaded).toBeNull();
    });
  });

  describe("persistSeo step", () => {
    it("persists SEO data to database", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");

      const domain = await upsertDomain({
        name: "persist.com",
        tld: "com",
        unicodeName: "persist.com",
      });

      fetchRemoteAssetMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes("robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            contentType: "text/plain",
            buffer: Buffer.from("User-agent: *\nAllow: /"),
            finalUrl: url,
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          contentType: "text/html",
          buffer: Buffer.from(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Persist Test</title>
                <meta property="og:title" content="Persisted Title">
                <link rel="canonical" href="https://persist.com/">
              </head>
              <body></body>
            </html>
          `),
          finalUrl: "https://persist.com/",
        });
      });

      const { seoWorkflow } = await import("./workflow");
      await seoWorkflow({ domain: "persist.com" });

      // Verify data was persisted
      const { db } = await import("@/lib/db/client");
      const { seo } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(seo)
        .where(eq(seo.domainId, domain.id));

      expect(rows.length).toBe(1);
      expect(rows[0].previewTitle).toBe("Persisted Title");
      expect(rows[0].canonicalUrl).toBe("https://persist.com/");
    });
  });
});
