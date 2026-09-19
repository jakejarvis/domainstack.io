/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string; allowHttp?: boolean }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(...args: unknown[]) => Promise<Buffer>>(),
  storeImage: vi.fn<(...args: unknown[]) => Promise<{ url: string }>>(),
  isDomainBlocked: vi.fn<(domain: string) => Promise<boolean>>(),
  ensureDomainRecord: vi.fn<(domain: string) => Promise<{ id: string }>>(),
  upsertSeo: vi.fn<(row: SeoRow) => Promise<void>>(),
}));

interface SeoRow {
  expiresAt: Date;
  fetchedAt: Date;
  previewImageUploadedUrl: string | null;
  robotsSitemaps: string[];
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
vi.mock("@domainstack/db/queries/seo", () => ({ upsertSeo: mocks.upsertSeo }));

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
});
