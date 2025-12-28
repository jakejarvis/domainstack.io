/* @vitest-environment node */

import { HttpResponse, http } from "msw";
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
import { server } from "@/mocks/server";

// getSeo is imported dynamically after mocks are applied
let getSeo: typeof import("./seo").getSeo;

const storeImageMock = vi.hoisted(() =>
  vi.fn(async () => ({
    url: "https://test-store.public.blob.vercel-storage.com/image.webp",
    pathname: "image.webp",
  })),
);

vi.mock("@/lib/storage", () => ({
  storeImage: storeImageMock,
}));

// We rely on MSW for DNS lookups now (via handlers.ts)
// No need to mock @/lib/dns-lookup

vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");

// Mock sharp to return a pipeline that resolves a buffer (now using webp)
vi.mock("sharp", () => ({
  default: (_input: unknown, _opts?: unknown) => ({
    resize: () => ({
      toFormat: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
      webp: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
      jpeg: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
      png: () => ({
        toBuffer: async () => Buffer.from([1, 2, 3]),
      }),
    }),
  }),
}));

vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

beforeAll(async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  await makePGliteDb();
});

beforeEach(async () => {
  const { resetPGliteDb } = await import("@/lib/db/pglite");
  await resetPGliteDb();
  ({ getSeo } = await import("./seo"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

describe("getSeo", () => {
  it("uses cached response when meta exists in cache", async () => {
    const { upsertDomain } = await import("@/lib/db/repos/domains");
    const { upsertSeo } = await import("@/lib/db/repos/seo");
    const { ttlForSeo } = await import("@/lib/ttl");

    const now = new Date();
    const d = await upsertDomain({
      name: "verified-dns.test",
      tld: "test",
      unicodeName: "verified-dns.test",
    });
    await upsertSeo({
      domainId: d.id,
      sourceFinalUrl: "https://verified-dns.test/",
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

    const out = await getSeo("verified-dns.test");
    expect(out).toBeTruthy();
  });

  it("sets html error when non-HTML content-type returned", async () => {
    // nonhtml.test resolves via handlers.ts
    server.use(
      http.get("https://nonhtml.test/", () => {
        return HttpResponse.json(
          {},
          { headers: { "content-type": "application/json" } },
        );
      }),
      http.get("https://nonhtml.test/robots.txt", () => {
        return new HttpResponse("", {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const out = await getSeo("nonhtml.test");
    expect(out.errors?.html).toMatch(/Non-HTML content-type/i);
  });

  it("sets robots error when robots.txt non-text content-type", async () => {
    // robots-content.test resolves via handlers.ts
    server.use(
      http.get("https://robots-content.test/", () => {
        return new HttpResponse("<html></html>", {
          headers: { "content-type": "text/html" },
        });
      }),
      http.get("https://robots-content.test/robots.txt", () => {
        return HttpResponse.json(
          {},
          { headers: { "content-type": "application/json" } },
        );
      }),
    );

    const out = await getSeo("robots-content.test");
    expect(out.errors?.robots ?? "").toMatch(/Unexpected robots content-type/i);
  });

  it("sets preview.imageUploaded to null when image fetch fails and preserves original", async () => {
    // img-fail.test resolves via handlers.ts
    server.use(
      http.get("https://img-fail.test/", () => {
        return new HttpResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/og.png" />
          </head></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }),
      http.get("https://img-fail.test/robots.txt", () => {
        return new HttpResponse("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }),
      // Fail the image fetch
      http.get("https://img-fail.test/og.png", () => {
        return HttpResponse.error();
      }),
    );

    const out = await getSeo("img-fail.test");
    expect(out.preview?.image ?? "").toContain("/og.png");
    expect(out.preview?.imageUploaded ?? null).toBeNull();
  });

  it("filters out non-http(s) schemes during parsing (SSRF protection)", async () => {
    // ssrf-test.test resolves via handlers.ts
    server.use(
      http.get("https://ssrf-test.test/", () => {
        return new HttpResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="file:///etc/passwd" />
          </head></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }),
      http.get("https://ssrf-test.test/robots.txt", () => {
        return new HttpResponse("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const out = await getSeo("ssrf-test.test");
    // non-http(s) URLs are filtered during parsing via resolveUrlMaybe
    expect(out.preview?.image).toBeNull();
    expect(out.preview?.imageUploaded).toBeNull();
  });

  it("resolves relative OG image URLs against base URL", async () => {
    // relative-url.test resolves via handlers.ts
    server.use(
      http.get("https://relative-url.test/", () => {
        return new HttpResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="/images/og.png" />
          </head></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }),
      http.get("https://relative-url.test/robots.txt", () => {
        return new HttpResponse("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }),
      http.get("https://relative-url.test/images/og.png", () => {
        return new HttpResponse(Buffer.from([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        });
      }),
    );

    const out = await getSeo("relative-url.test");
    expect(out.preview?.image).toBe("https://relative-url.test/images/og.png");
    expect(storeImageMock).toHaveBeenCalled();
  });

  it("skips OG image fetches that point directly to loopback IPs", async () => {
    // loopback.test resolves via handlers.ts
    server.use(
      http.get("https://loopback.test/", () => {
        return new HttpResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://127.0.0.1/og.png" />
          </head></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }),
      http.get("https://loopback.test/robots.txt", () => {
        return new HttpResponse("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const out = await getSeo("loopback.test");
    expect(out.preview?.imageUploaded).toBeNull();
  });

  it("skips OG image fetches when hostname resolves to a private IP", async () => {
    // private-resolve.test resolves via handlers.ts
    // assets.test resolves to private IP via handlers.ts
    server.use(
      http.get("https://private-resolve.test/", () => {
        return new HttpResponse(
          `<!doctype html><html><head>
            <title>Site</title>
            <meta property="og:image" content="https://assets.test/og.png" />
          </head></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }),
      http.get("https://private-resolve.test/robots.txt", () => {
        return new HttpResponse("User-agent: *\nAllow: /", {
          headers: { "content-type": "text/plain" },
        });
      }),
    );

    const out = await getSeo("private-resolve.test");
    expect(out.preview?.imageUploaded).toBeNull();
  });
});
