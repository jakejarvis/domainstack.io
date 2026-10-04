/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch/errors";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string; allowHttp?: boolean }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(...args: unknown[]) => Promise<Buffer>>(),
  storeImage: vi.fn<(...args: unknown[]) => Promise<{ url: string }>>(),
  isDomainBlocked: vi.fn<(domain: string) => Promise<boolean>>(),
  ensureDomainRecord: vi.fn<(domain: string) => Promise<{ id: string }>>(),
  upsertSeo: vi.fn<(row: SeoRow) => Promise<void>>(),
  getCachedSeo: vi.fn<(domain: string) => Promise<unknown>>(),
  getSeoImageState: vi.fn<(domainId: string) => Promise<ImageState | null>>(),
}));

interface ImageState {
  previewImageUrl: string | null;
  previewImageUploadedUrl: string | null;
  previewImageStoredAt: Date | null;
}

interface SeoRow {
  expiresAt: Date;
  fetchedAt: Date;
  previewImageUploadedUrl: string | null;
  previewImageStoredAt: Date | null;
  robotsSitemaps: string[];
  errors: Record<string, string>;
}

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));
vi.mock("@domainstack/image", () => ({
  optimizeImage: mocks.optimizeImage,
  storeImage: mocks.storeImage,
}));
vi.mock("@domainstack/db/queries/blocked-domains", () => ({
  isDomainBlocked: mocks.isDomainBlocked,
}));
vi.mock("@domainstack/db/queries/domains", () => ({
  ensureDomainRecord: mocks.ensureDomainRecord,
}));
vi.mock("@domainstack/db/queries/seo", () => ({
  upsertSeo: mocks.upsertSeo,
  getCachedSeo: mocks.getCachedSeo,
  getSeoImageState: mocks.getSeoImageState,
}));

import { fetchHttpHeaders } from "../headers/fetch";
import { fetchSeo } from "./index";

const DOMAIN = "example.com";
const IMAGE_URL = "https://example.com/og.png";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

const HTML = `<html><head><title>Example</title>
  <meta property="og:image" content="${IMAGE_URL}"></head><body></body></html>`;

function htmlResponse() {
  return {
    ok: true,
    status: 200,
    contentType: "text/html",
    finalUrl: `https://${DOMAIN}/`,
    buffer: Buffer.from(HTML),
    headers: {},
    setCookies: [],
  };
}

function robotsResponse(body: string, finalUrl = `https://${DOMAIN}/robots.txt`) {
  return {
    ok: true,
    status: 200,
    contentType: "text/plain",
    finalUrl,
    buffer: Buffer.from(body),
    headers: {},
  };
}

function imageResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType: "image/png",
    finalUrl: IMAGE_URL,
    buffer: Buffer.from("png"),
    headers: {},
  };
}

/** Wire safeFetch: HTML for the page, `robots` for robots.txt, `image` for the og:image. */
function respondWith(options: {
  robots?: ReturnType<typeof robotsResponse>;
  image: () => Promise<unknown>;
}) {
  mocks.safeFetch.mockImplementation(async ({ url }) => {
    if (url.endsWith("/robots.txt")) return options.robots ?? robotsResponse("User-agent: *");
    if (url === IMAGE_URL) return options.image();
    return htmlResponse();
  });
}

function persisted(): SeoRow {
  expect(mocks.upsertSeo).toHaveBeenCalledOnce();
  return mocks.upsertSeo.mock.calls[0][0];
}

function lifetimeMs(row: SeoRow): number {
  return row.expiresAt.getTime() - row.fetchedAt.getTime();
}

describe("fetchSeo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isDomainBlocked.mockResolvedValue(false);
    mocks.ensureDomainRecord.mockResolvedValue({ id: "domain-id" });
    mocks.upsertSeo.mockResolvedValue(undefined);
    mocks.getSeoImageState.mockResolvedValue(null);
    mocks.getCachedSeo.mockResolvedValue({
      data: { meta: null, robots: null, preview: null, source: { finalUrl: null, status: null } },
      stale: false,
      fetchedAt: null,
      expiresAt: null,
    });
    mocks.optimizeImage.mockResolvedValue(Buffer.from("optimized"));
    mocks.storeImage.mockResolvedValue({ url: "https://blob.test/og.png" });
  });

  describe("robots.txt", () => {
    it("resolves relative sitemap URLs against where robots.txt actually lives after a redirect", async () => {
      respondWith({
        robots: robotsResponse("Sitemap: /sitemap.xml", "https://www.example.com/robots.txt"),
        image: async () => imageResponse(),
      });

      await fetchSeo(DOMAIN);

      expect(persisted().robotsSitemaps).toEqual(["https://www.example.com/sitemap.xml"]);
    });

    it.each(["", "application/octet-stream"])(
      "parses robots.txt served with content-type %j",
      async (contentType) => {
        respondWith({
          robots: {
            ...robotsResponse("Sitemap: https://example.com/sitemap.xml"),
            contentType,
          },
          image: async () => imageResponse(),
        });

        await fetchSeo(DOMAIN);

        expect(persisted().robotsSitemaps).toEqual(["https://example.com/sitemap.xml"]);
        expect(persisted().errors.robots).toBeUndefined();
      },
    );

    it("discards robots.txt served as a clearly non-text type", async () => {
      respondWith({
        robots: {
          ...robotsResponse("Sitemap: https://example.com/sitemap.xml"),
          contentType: "image/png",
        },
        image: async () => imageResponse(),
      });

      await fetchSeo(DOMAIN);

      expect(persisted().robotsSitemaps).toEqual([]);
      expect(persisted().errors.robots).toBe("Unexpected robots content-type: image/png");
    });
  });

  describe("og:image", () => {
    it("is fetched with http allowed, since plain-http pages reference plain-http images", async () => {
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      const imageCall = mocks.safeFetch.mock.calls.find(([opts]) => opts.url === IMAGE_URL);
      expect(imageCall?.[0].allowHttp).toBe(true);
    });

    it("is stored and the result cached for the full day on success", async () => {
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      const row = persisted();
      expect(row.previewImageUploadedUrl).toBe("https://blob.test/og.png");
      expect(lifetimeMs(row)).toBe(ONE_DAY_MS);
    });

    it.each([
      ["a 404", async () => imageResponse(404)],
      ["a blocked host", async () => Promise.reject(new SafeFetchError("host_blocked", "blocked"))],
    ])(
      "caches the result for the full day when the image is definitively unavailable (%s)",
      async (_label, image) => {
        respondWith({ image });

        await fetchSeo(DOMAIN);

        const row = persisted();
        expect(row.previewImageUploadedUrl).toBeNull();
        expect(lifetimeMs(row)).toBe(ONE_DAY_MS);
      },
    );

    it("caches the result for the full day when the bytes are not a usable image", async () => {
      respondWith({ image: async () => imageResponse() });
      mocks.optimizeImage.mockRejectedValue(
        new Error("Input buffer contains unsupported image format"),
      );

      await fetchSeo(DOMAIN);

      expect(lifetimeMs(persisted())).toBe(ONE_DAY_MS);
    });

    it.each([
      ["a 503", async () => imageResponse(503)],
      ["a 429", async () => imageResponse(429)],
      ["a 408", async () => imageResponse(408)],
      ["a timeout", async () => Promise.reject(new SafeFetchError("timeout", "timed out"))],
    ])("retries soon instead of caching 'no image' for a day after %s", async (_label, image) => {
      respondWith({ image });

      await fetchSeo(DOMAIN);

      const row = persisted();
      expect(row.previewImageUploadedUrl).toBeNull();
      expect(lifetimeMs(row)).toBe(RETRY_MS);
    });

    it("retries soon when storage fails", async () => {
      respondWith({ image: async () => imageResponse() });
      mocks.storeImage.mockRejectedValue(new Error("blob store unavailable"));

      await fetchSeo(DOMAIN);

      expect(lifetimeMs(persisted())).toBe(RETRY_MS);
    });
  });

  describe("og:image reuse", () => {
    const STORED_URL = "https://blob.test/stored.png";

    function storedImage(overrides: Partial<ImageState> & { ageMs: number }) {
      const { ageMs, ...rest } = overrides;
      const storedAt = new Date(Date.now() - ageMs);
      mocks.getSeoImageState.mockResolvedValue({
        previewImageUrl: IMAGE_URL,
        previewImageUploadedUrl: STORED_URL,
        previewImageStoredAt: storedAt,
        ...rest,
      });
      return storedAt;
    }

    const imageFetches = () =>
      mocks.safeFetch.mock.calls.filter(([opts]) => opts.url === IMAGE_URL);

    it("skips download and upload when the same URL was stored a day ago", async () => {
      const storedAt = storedImage({ ageMs: ONE_DAY_MS });
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      expect(imageFetches()).toHaveLength(0);
      expect(mocks.storeImage).not.toHaveBeenCalled();
      const row = persisted();
      expect(row.previewImageUploadedUrl).toBe(STORED_URL);
      // The original stored-at carries over, so the 7-day window is not extended.
      expect(row.previewImageStoredAt).toEqual(storedAt);
      expect(lifetimeMs(row)).toBe(ONE_DAY_MS);
    });

    it("re-processes the image when it was stored 8 days ago", async () => {
      storedImage({ ageMs: 8 * ONE_DAY_MS });
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      expect(imageFetches()).toHaveLength(1);
      const row = persisted();
      expect(row.previewImageUploadedUrl).toBe("https://blob.test/og.png");
      expect(row.previewImageStoredAt).toBeInstanceOf(Date);
    });

    it("re-processes the image when the source URL changed", async () => {
      storedImage({ ageMs: ONE_DAY_MS, previewImageUrl: "https://example.com/old-og.png" });
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      expect(imageFetches()).toHaveLength(1);
      expect(persisted().previewImageUploadedUrl).toBe("https://blob.test/og.png");
    });

    it("never reuses an image for a blocked domain", async () => {
      storedImage({ ageMs: ONE_DAY_MS });
      mocks.isDomainBlocked.mockResolvedValue(true);
      respondWith({ image: async () => imageResponse() });

      await fetchSeo(DOMAIN);

      expect(mocks.getSeoImageState).not.toHaveBeenCalled();
      expect(persisted().previewImageUploadedUrl).toBeNull();
    });
  });

  describe("page fetch", () => {
    it("shares the homepage request with a concurrent headers fetch", async () => {
      respondWith({ image: async () => imageResponse() });

      await Promise.all([fetchSeo(DOMAIN), fetchHttpHeaders(DOMAIN)]);

      const pageCalls = mocks.safeFetch.mock.calls.filter(
        ([opts]) => opts.url === `https://${DOMAIN}/`,
      );
      expect(pageCalls).toHaveLength(1);
    });

    it("follows an off-host redirect from where the homepage load stopped", async () => {
      const target = "https://example.net/home";
      mocks.safeFetch.mockImplementation(async ({ url }) => {
        if (url.endsWith("/robots.txt")) return robotsResponse("User-agent: *");
        if (url === `https://${DOMAIN}/`) {
          return {
            ok: false,
            status: 301,
            contentType: null,
            finalUrl: `https://${DOMAIN}/`,
            buffer: Buffer.alloc(0),
            headers: { location: target },
            setCookies: [],
          };
        }
        if (url === target) return { ...htmlResponse(), finalUrl: target };
        return imageResponse();
      });

      await expect(fetchSeo(DOMAIN)).resolves.toMatchObject({ success: true });
      const continuation = mocks.safeFetch.mock.calls.find(([opts]) => opts.url === target);
      expect(continuation?.[0]).toMatchObject({
        currentUrl: `https://${DOMAIN}/`,
        maxRedirects: 4,
      });
      expect(continuation?.[0]).not.toHaveProperty("allowedHosts");
    });
  });

  describe("page fetch failures", () => {
    it("treats a timeout on a hostname containing ssl as transient, not a TLS error", async () => {
      mocks.safeFetch.mockRejectedValue(
        new SafeFetchError("timeout", "Request to https://hassle.com/ timed out"),
      );

      await expect(fetchSeo("hassle.com")).rejects.toThrow("HTML data unavailable");
      expect(mocks.upsertSeo).not.toHaveBeenCalled();
    });

    it("reports a certificate error nested in the cause chain as tls_error", async () => {
      mocks.safeFetch.mockRejectedValue(
        new SafeFetchError(
          "connection_error",
          `Request to https://${DOMAIN}/ failed: certificate has expired`,
          undefined,
          {
            cause: Object.assign(new Error("certificate has expired"), {
              code: "CERT_HAS_EXPIRED",
            }),
          },
        ),
      );

      await expect(fetchSeo(DOMAIN)).resolves.toEqual({ success: false, error: "tls_error" });
      expect(mocks.upsertSeo).toHaveBeenCalledOnce();
    });
  });
});
