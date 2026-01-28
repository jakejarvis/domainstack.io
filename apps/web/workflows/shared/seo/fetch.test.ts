import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";

// Hoist mocks for external dependencies
const safeFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@domainstack/safe-fetch", () => ({
  safeFetch: safeFetchMock,
  isExpectedDnsError: vi.fn().mockReturnValue(false),
}));

// Mock fetch utilities
vi.mock("@domainstack/core/tls", () => ({
  isExpectedTlsError: vi.fn().mockReturnValue(false),
}));

// Mock blocked domains repo
vi.mock("@/lib/db/repos", () => ({
  blockedDomainsRepo: {
    isDomainBlocked: vi.fn().mockResolvedValue(false),
  },
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
  optimizeImage: vi.fn().mockResolvedValue(Buffer.from("optimized")),
}));

afterEach(() => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

describe("fetchHtmlStep", () => {
  it("parses HTML meta tags correctly", async () => {
    safeFetchMock.mockImplementation(({ url }: { url: string }) => {
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
              <meta property="og:image" content="https://test.invalid/og.jpg">
              <meta name="twitter:card" content="summary_large_image">
            </head>
            <body></body>
          </html>
        `),
        finalUrl: url,
        headers: {},
      });
    });

    const { fetchHtmlStep } = await import("./fetch");
    const result = await fetchHtmlStep("test.invalid");

    expect(result.success).toBe(true);
    expect(result.meta).not.toBeNull();
    expect(result.meta?.general.title).toBe("Test Page");
    expect(result.meta?.general.description).toBe("Test description");
    expect(result.meta?.openGraph.title).toBe("OG Title");
    expect(result.meta?.twitter.card).toBe("summary_large_image");
  });

  it("returns error for non-HTML content", async () => {
    safeFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "application/json",
      buffer: Buffer.from("{}"),
      finalUrl: "https://test.invalid/",
      headers: {},
    });

    const { fetchHtmlStep } = await import("./fetch");
    const result = await fetchHtmlStep("api.test.invalid");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Non-HTML");
  });

  it("returns error for HTTP error status", async () => {
    safeFetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("<html>Not Found</html>"),
      finalUrl: "https://test.invalid/",
      headers: {},
    });

    const { fetchHtmlStep } = await import("./fetch");
    const result = await fetchHtmlStep("notfound.test.invalid");

    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
  });
});

describe("fetchRobotsStep", () => {
  it("parses robots.txt correctly", async () => {
    safeFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "text/plain",
      buffer: Buffer.from(`User-agent: *
Disallow: /private/
Allow: /
Sitemap: https://test.invalid/sitemap.xml`),
      finalUrl: "https://test.invalid/robots.txt",
      headers: {},
    });

    const { fetchRobotsStep } = await import("./fetch");
    const result = await fetchRobotsStep("test.invalid");

    expect(result.robots).not.toBeNull();
    expect(result.robots?.sitemaps).toContain(
      "https://test.invalid/sitemap.xml",
    );
  });

  it("returns null robots for 404", async () => {
    safeFetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("Not Found"),
      finalUrl: "https://test.invalid/robots.txt",
      headers: {},
    });

    const { fetchRobotsStep } = await import("./fetch");
    const result = await fetchRobotsStep("test.invalid");

    expect(result.robots).toBeNull();
    expect(result.error).toContain("404");
  });
});

describe("processOgImageStep", () => {
  it("fetches and processes OG image", async () => {
    safeFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      contentType: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
      finalUrl: "https://test.invalid/og.jpg",
      headers: {},
    });

    const { processOgImageStep } = await import("./fetch");
    const result = await processOgImageStep(
      "test.invalid",
      "https://test.invalid/og.jpg",
      "https://test.invalid/",
    );

    expect(result.url).toBe("https://blob.vercel-storage.com/og-test.webp");
  });

  it("returns null URL on fetch failure", async () => {
    safeFetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      contentType: "text/html",
      buffer: Buffer.from("Not Found"),
      finalUrl: "https://test.invalid/og.jpg",
      headers: {},
    });

    const { processOgImageStep } = await import("./fetch");
    const result = await processOgImageStep(
      "test.invalid",
      "https://test.invalid/og.jpg",
      "https://test.invalid/",
    );

    expect(result.url).toBeNull();
  });
});
