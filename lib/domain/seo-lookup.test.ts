import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";

// Hoist mocks for external dependencies
const fetchRemoteAssetMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/fetch-remote-asset", () => ({
  fetchRemoteAsset: fetchRemoteAssetMock,
}));

// Mock fetch utilities
vi.mock("@/lib/tls-utils", () => ({
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

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("fetchHtmlMeta", () => {
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
              <title>Test Page</title>
              <meta name="description" content="Test description">
              <meta property="og:title" content="OG Title">
              <meta property="og:description" content="OG Description">
              <meta property="og:image" content="https://example.com/og.jpg">
              <meta name="twitter:card" content="summary_large_image">
            </head>
            <body></body>
          </html>
        `),
        finalUrl: url,
        headers: {},
      });
    });

    const { fetchHtmlMeta } = await import("./seo-lookup");
    const result = await fetchHtmlMeta("example.com");

    expect(result.success).toBe(true);
    expect(result.meta).not.toBeNull();
    expect(result.meta?.general.title).toBe("Test Page");
    expect(result.meta?.general.description).toBe("Test description");
    expect(result.meta?.openGraph.title).toBe("OG Title");
    expect(result.meta?.twitter.card).toBe("summary_large_image");
  });

  it("returns error for non-HTML content", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "application/json",
      buffer: Buffer.from("{}"),
      finalUrl: "https://example.com/",
      headers: {},
    });

    const { fetchHtmlMeta } = await import("./seo-lookup");
    const result = await fetchHtmlMeta("api.example.com");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Non-HTML");
  });

  it("returns error for HTTP error status", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("<html>Not Found</html>"),
      finalUrl: "https://example.com/",
      headers: {},
    });

    const { fetchHtmlMeta } = await import("./seo-lookup");
    const result = await fetchHtmlMeta("notfound.example.com");

    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
  });
});

describe("fetchRobotsTxt", () => {
  it("parses robots.txt correctly", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "text/plain",
      buffer: Buffer.from(`User-agent: *
Disallow: /private/
Allow: /
Sitemap: https://example.com/sitemap.xml`),
      finalUrl: "https://example.com/robots.txt",
      headers: {},
    });

    const { fetchRobotsTxt } = await import("./seo-lookup");
    const result = await fetchRobotsTxt("example.com");

    expect(result.robots).not.toBeNull();
    expect(result.robots?.sitemaps).toContain(
      "https://example.com/sitemap.xml",
    );
  });

  it("returns null robots for 404", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("Not Found"),
      finalUrl: "https://example.com/robots.txt",
      headers: {},
    });

    const { fetchRobotsTxt } = await import("./seo-lookup");
    const result = await fetchRobotsTxt("example.com");

    expect(result.robots).toBeNull();
    expect(result.error).toContain("404");
  });
});

describe("processOgImageUpload", () => {
  it("fetches and processes OG image", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
      finalUrl: "https://example.com/og.jpg",
      headers: {},
    });

    const { processOgImageUpload } = await import("./seo-lookup");
    const result = await processOgImageUpload(
      "example.com",
      "https://example.com/og.jpg",
      "https://example.com/",
    );

    expect(result.url).toBe("https://blob.vercel-storage.com/og-test.webp");
  });

  it("returns null URL on fetch failure", async () => {
    fetchRemoteAssetMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("Not Found"),
      finalUrl: "https://example.com/og.jpg",
      headers: {},
    });

    const { processOgImageUpload } = await import("./seo-lookup");
    const result = await processOgImageUpload(
      "example.com",
      "https://example.com/og.jpg",
      "https://example.com/",
    );

    expect(result.url).toBeNull();
  });
});
