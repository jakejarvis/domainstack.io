/* @vitest-environment node */

// Mock toRegistrableDomain to allow .invalid domains for testing
vi.mock("@/lib/domain-server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/domain-server")>(
    "@/lib/domain-server",
  );
  return {
    ...actual,
    toRegistrableDomain: (input: string) => {
      // Allow .invalid domains (reserved, never resolve) for safe testing
      if (input.endsWith(".invalid")) {
        return input.toLowerCase();
      }
      // Use real implementation for everything else
      return actual.toRegistrableDomain(input);
    },
  };
});

const dnsLookupMock = vi.hoisted(() =>
  vi.fn(async () => [{ address: "203.0.113.10", family: 4 }]),
);

vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));

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

// getSeo is imported dynamically after mocks are applied
let getSeo: typeof import("./seo").getSeo;

const blobPutMock = vi.hoisted(() =>
  vi.fn(async (pathname: string) => ({
    url: `https://test-store.public.blob.vercel-storage.com/${pathname}`,
    downloadUrl: `https://test-store.public.blob.vercel-storage.com/${pathname}?download=1`,
    contentType: "image/webp",
  })),
);

vi.mock("@vercel/blob", () => ({
  put: blobPutMock,
}));

vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  vi.doMock("@/lib/db/client", () => ({ db }));
  const { makeInMemoryRedis } = await import("@/lib/redis-mock");
  const impl = makeInMemoryRedis();
  vi.doMock("@/lib/redis", () => impl);
});

beforeEach(() => {
  dnsLookupMock.mockReset();
  dnsLookupMock.mockImplementation(async () => [
    { address: "203.0.113.10", family: 4 },
  ]);
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterEach(async () => {
  vi.clearAllMocks();
  const { resetInMemoryRedis } = await import("@/lib/redis-mock");
  resetInMemoryRedis();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

// Ensure module under test is loaded after mocks
beforeEach(async () => {
  ({ getSeo } = await import("./seo"));
});

function htmlResponse(html: string, url: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    text: async () => html,
    url,
  } as unknown as Response;
}

function textResponse(text: string, contentType = "text/plain") {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType }),
    text: async () => text,
    url: "",
  } as unknown as Response;
}

// imageResponse helper removed along with flaky test

describe("getSeo", () => {
  it("uses cached response when meta exists in cache", async () => {
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const { upsertSeo } = await import("@/lib/db/repos/seo");
    const { ttlForSeo } = await import("@/lib/ttl");

    const now = new Date();
    const d = await upsertDomain({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    });
    await upsertSeo({
      domainId: d.id,
      sourceFinalUrl: "https://example.com/",
      sourceStatus: 200,
      metaOpenGraph: {},
      metaTwitter: {},
      metaGeneral: {},
      previewTitle: null,
      previewDescription: null,
      previewImageUrl: null,
      canonicalUrl: null,
      robots: { fetched: true, groups: [], sitemaps: [] },
      robotsSitemaps: [],
      errors: {},
      fetchedAt: now,
      expiresAt: ttlForSeo(now),
    });

    const out = await getSeo("example.com");
    expect(out).toBeTruthy();
  });

  it("sets html error when non-HTML content-type returned", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => "{}",
        url: "https://example.com/",
      } as unknown as Response)
      .mockResolvedValueOnce(textResponse("", "text/plain"));

    const out = await getSeo("nonhtml.invalid");
    expect(out.errors?.html).toMatch(/Non-HTML content-type/i);
    fetchMock.mockRestore();
  });

  it("sets robots error when robots.txt non-text content-type", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(htmlResponse("<html></html>", "https://x/"))
      .mockResolvedValueOnce(textResponse("{}", "application/json"));

    const out = await getSeo("robots-content.invalid");
    expect(out.errors?.robots ?? "").toMatch(/Unexpected robots content-type/i);
    fetchMock.mockRestore();
  });

  it("sets preview.imageUploaded to null when image fetch fails and preserves original", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        htmlResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/og.png" />
          </head></html>`,
          "https://example.com/",
        ),
      )
      .mockResolvedValueOnce(
        textResponse("User-agent: *\nAllow: /", "text/plain"),
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => new ArrayBuffer(0),
        url: "",
      } as unknown as Response);

    const out = await getSeo("img-fail.invalid");
    // original image remains for Meta Tags display
    expect(out.preview?.image ?? "").toContain("/og.png");
    // uploaded url is null on failure for privacy-safe rendering
    expect(out.preview?.imageUploaded ?? null).toBeNull();
    fetchMock.mockRestore();
  });

  it("filters out non-http(s) schemes during parsing (SSRF protection)", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        htmlResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="file:///etc/passwd" />
          </head></html>`,
          "https://example.com/",
        ),
      )
      .mockResolvedValueOnce(
        textResponse("User-agent: *\nAllow: /", "text/plain"),
      );

    const out = await getSeo("ssrf-test.invalid");
    // non-http(s) URLs are filtered during parsing via resolveUrlMaybe
    expect(out.preview?.image).toBeNull();
    expect(out.preview?.imageUploaded).toBeNull();
    // Verify fetch was only called twice (HTML + robots.txt), never for the image
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("resolves relative OG image URLs against base URL", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        htmlResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/images/og.png" />
          </head></html>`,
          "https://example.com/page",
        ),
      )
      .mockResolvedValueOnce(
        textResponse("User-agent: *\nAllow: /", "text/plain"),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new ArrayBuffer(100),
        url: "",
      } as unknown as Response);

    const out = await getSeo("relative-url.invalid");
    // Relative URL should be resolved to absolute
    expect(out.preview?.image).toBe("https://example.com/images/og.png");
    // Should have attempted to upload the resolved URL
    expect(fetchMock).toHaveBeenCalledTimes(3); // HTML + robots.txt + image
    fetchMock.mockRestore();
  });

  it("skips OG image fetches that point directly to loopback IPs", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        htmlResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://127.0.0.1/og.png" />
          </head></html>`,
          "https://limit.invalid/",
        ),
      )
      .mockResolvedValueOnce(
        textResponse("User-agent: *\nAllow: /", "text/plain"),
      );

    const out = await getSeo("loopback.invalid");
    expect(out.preview?.imageUploaded).toBeNull();
    // Only HTML + robots fetch should occur (image fetch blocked)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("skips OG image fetches when hostname resolves to a private IP", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.12", family: 4 }]);

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        htmlResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://assets.example.com/og.png" />
          </head></html>`,
          "https://limit.invalid/",
        ),
      )
      .mockResolvedValueOnce(
        textResponse("User-agent: *\nAllow: /", "text/plain"),
      );

    const out = await getSeo("private-resolve.invalid");
    expect(out.preview?.imageUploaded).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
});
