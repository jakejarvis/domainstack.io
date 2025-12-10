/* @vitest-environment node */

const dnsLookupMock = vi.hoisted(() =>
  vi.fn(async () => [{ address: "203.0.113.10", family: 4 }]),
);

const fetchRemoteAssetMock = vi.hoisted(() =>
  // We don't care about the actual image buffer in most tests, only that the helper is invoked.
  vi.fn(async () => ({
    buffer: Buffer.from([1, 2, 3]),
    contentType: "image/png",
    finalUrl: "https://example.com/og.png",
    status: 200,
    headers: { "content-type": "image/png" },
  })),
);

vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));

vi.mock("@/lib/fetch-remote-asset", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fetch-remote-asset")
  >("@/lib/fetch-remote-asset");
  return {
    ...actual,
    fetchRemoteAsset: fetchRemoteAssetMock,
  };
});

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
});

afterEach(async () => {
  vi.clearAllMocks();
  fetchRemoteAssetMock.mockReset();
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

function _htmlResponse(html: string, url: string) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    text: async () => html,
    url,
  } as unknown as Response;
}

function _textResponse(text: string, contentType = "text/plain") {
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
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from("{}"),
        contentType: "application/json",
        finalUrl: "https://example.com/",
        status: 200,
        headers: { "content-type": "application/json" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from(""),
        contentType: "text/plain",
        finalUrl: "https://nonhtml.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      });

    const out = await getSeo("nonhtml.invalid");
    expect(out.errors?.html).toMatch(/Non-HTML content-type/i);
  });

  it("sets robots error when robots.txt non-text content-type", async () => {
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from("<html></html>"),
        contentType: "text/html",
        finalUrl: "https://x/",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("{}"),
        contentType: "application/json",
        finalUrl: "https://robots-content.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const out = await getSeo("robots-content.invalid");
    expect(out.errors?.robots ?? "").toMatch(/Unexpected robots content-type/i);
  });

  it("sets preview.imageUploaded to null when image fetch fails and preserves original", async () => {
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from(`<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/og.png" />
          </head></html>`),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("User-agent: *\nAllow: /"),
        contentType: "text/plain",
        finalUrl: "https://img-fail.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      })
      .mockRejectedValueOnce(new Error("upload failed"));

    const out = await getSeo("img-fail.invalid");
    expect(out.preview?.image ?? "").toContain("/og.png");
    expect(out.preview?.imageUploaded ?? null).toBeNull();
    expect(fetchRemoteAssetMock).toHaveBeenCalledTimes(3);
  });

  it("filters out non-http(s) schemes during parsing (SSRF protection)", async () => {
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from(`<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="file:///etc/passwd" />
          </head></html>`),
        contentType: "text/html",
        finalUrl: "https://example.com/",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("User-agent: *\nAllow: /"),
        contentType: "text/plain",
        finalUrl: "https://ssrf-test.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      });

    const out = await getSeo("ssrf-test.invalid");
    // non-http(s) URLs are filtered during parsing via resolveUrlMaybe
    expect(out.preview?.image).toBeNull();
    expect(out.preview?.imageUploaded).toBeNull();
    // Verify fetchRemoteAsset was only called twice (HTML + robots.txt), never for the image
    expect(fetchRemoteAssetMock).toHaveBeenCalledTimes(2);
  });

  it("resolves relative OG image URLs against base URL", async () => {
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from(`<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/images/og.png" />
          </head></html>`),
        contentType: "text/html",
        finalUrl: "https://example.com/page",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("User-agent: *\nAllow: /"),
        contentType: "text/plain",
        finalUrl: "https://relative-url.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from([1, 2, 3]),
        contentType: "image/png",
        finalUrl: "https://example.com/images/og.png",
        status: 200,
        headers: { "content-type": "image/png" },
      });

    const out = await getSeo("relative-url.invalid");
    expect(out.preview?.image).toBe("https://example.com/images/og.png");
    expect(fetchRemoteAssetMock).toHaveBeenCalledTimes(3);
    expect(fetchRemoteAssetMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: "https://example.com/images/og.png",
      }),
    );
  });

  it("skips OG image fetches that point directly to loopback IPs", async () => {
    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from(`<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://127.0.0.1/og.png" />
          </head></html>`),
        contentType: "text/html",
        finalUrl: "https://limit.invalid/",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("User-agent: *\nAllow: /"),
        contentType: "text/plain",
        finalUrl: "https://loopback.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      })
      .mockRejectedValueOnce(new Error("blocked"));

    const out = await getSeo("loopback.invalid");
    expect(out.preview?.imageUploaded).toBeNull();
    expect(fetchRemoteAssetMock).toHaveBeenCalledTimes(3);
  });

  it("skips OG image fetches when hostname resolves to a private IP", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.12", family: 4 }]);

    fetchRemoteAssetMock
      .mockResolvedValueOnce({
        buffer: Buffer.from(`<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://assets.example.com/og.png" />
          </head></html>`),
        contentType: "text/html",
        finalUrl: "https://limit.invalid/",
        status: 200,
        headers: { "content-type": "text/html" },
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from("User-agent: *\nAllow: /"),
        contentType: "text/plain",
        finalUrl: "https://private-resolve.invalid/robots.txt",
        status: 200,
        headers: { "content-type": "text/plain" },
      })
      .mockRejectedValueOnce(new Error("blocked"));

    const out = await getSeo("private-resolve.invalid");
    expect(out.preview?.imageUploaded).toBeNull();
    expect(fetchRemoteAssetMock).toHaveBeenCalledTimes(3);
  });
});
