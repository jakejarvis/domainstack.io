/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SafeFetchError } from "@domainstack/safe-fetch/errors";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn<(opts: { url: string; allowHttp?: boolean }) => Promise<unknown>>(),
  optimizeImage: vi.fn<(...args: unknown[]) => Promise<Buffer>>(),
  storeImage: vi.fn<(...args: unknown[]) => Promise<{ url: string }>>(),
  enforceRateLimit: vi.fn<(args: unknown) => Promise<unknown>>(),
  waitUntil: vi.fn<(work: Promise<unknown>) => void>(),
}));

vi.mock("@domainstack/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/safe-fetch")>()),
  safeFetch: mocks.safeFetch,
}));
vi.mock("@domainstack/image", () => ({
  optimizeImage: mocks.optimizeImage,
  storeImage: mocks.storeImage,
}));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));
vi.mock("@domainstack/redis/enforce", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@domainstack/redis/enforce")>()),
  enforceRateLimit: mocks.enforceRateLimit,
}));

const { getCachedSeo } = await import("@domainstack/db/queries/seo");
const { fetchSeo } = await import("./index");
const { lookupSection } = await import("../lookup");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
  vi.resetAllMocks();
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.optimizeImage.mockResolvedValue(Buffer.from("optimized"));
  mocks.storeImage.mockResolvedValue({ url: "https://blob.test/og.png" });
});

function respond(domain: string, page: { status: number; contentType: string; body: string }) {
  mocks.safeFetch.mockImplementation(async ({ url }) => {
    if (url.endsWith("/robots.txt")) {
      return {
        ok: false,
        status: 404,
        contentType: "text/plain",
        finalUrl: url,
        buffer: Buffer.from(""),
        headers: {},
      };
    }
    if (url.endsWith(".png")) {
      return {
        ok: true,
        status: 200,
        contentType: "image/png",
        finalUrl: url,
        buffer: Buffer.from("png"),
        headers: {},
      };
    }
    return {
      ok: page.status >= 200 && page.status < 300,
      status: page.status,
      contentType: page.contentType,
      finalUrl: `https://${domain}/`,
      buffer: Buffer.from(page.body),
      headers: {},
    };
  });
}

describe("fetchSeo", () => {
  // If the SEO response gains a field, add it to these fixtures so the parity
  // assertions cover it.
  describe("fresh vs cached parity", () => {
    it("returns the same data for a page with meta on a cold and a cached lookup", async () => {
      const domain = "parity-meta.com";
      respond(domain, {
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `<html><head><title>Parity</title>
          <meta name="description" content="A page">
          <meta property="og:title" content="Parity OG">
          <meta property="og:image" content="https://${domain}/og.png">
          <meta name="twitter:card" content="summary">
          <link rel="canonical" href="https://${domain}/"></head><body></body></html>`,
      });

      const fresh = await fetchSeo(domain);
      const cached = await getCachedSeo(domain);

      expect(fresh.success).toBe(true);
      expect(cached.data).not.toBeNull();
      expect(fresh).toEqual({ success: true, data: cached.data });
    });

    it("returns the same data when the homepage responds with HTTP 404", async () => {
      const domain = "parity-404.com";
      respond(domain, { status: 404, contentType: "text/html", body: "not found" });

      const fresh = await fetchSeo(domain);
      const cached = await getCachedSeo(domain);

      expect(cached.data).not.toBeNull();
      if (!fresh.success) throw new Error("expected success");
      expect(fresh.data).toEqual(cached.data);
      expect(fresh.data.meta).not.toBeNull();
      expect(fresh.data.errors?.html).toBe("HTTP 404");
    });
  });

  describe("permanent DNS failure", () => {
    it("is reported as a failure on a cold lookup and again from the cache, without refetching", async () => {
      const domain = "parity-dns.com";
      const cause = Object.assign(new Error(`getaddrinfo ENOTFOUND ${domain}`), {
        code: "ENOTFOUND",
      });
      mocks.safeFetch.mockRejectedValue(
        new SafeFetchError("dns_error", cause.message, undefined, { cause }),
      );

      await expect(fetchSeo(domain)).resolves.toEqual({ success: false, error: "dns_error" });

      mocks.safeFetch.mockClear();
      await expect(lookupSection("seo", domain)).resolves.toEqual({
        success: false,
        error: "dns_error",
      });
      expect(mocks.safeFetch).not.toHaveBeenCalled();
    });
  });
});
