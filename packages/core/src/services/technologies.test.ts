/* @vitest-environment node */
import type { lookup as dnsLookup } from "node:dns/promises";
import { readFileSync } from "node:fs";

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { getTechnologyCatalog } from "@domainstack/catalog";
import { TechnologyCatalogSchema } from "@domainstack/catalog/technologies";

import type { fetchDns } from "./dns";

const seedCatalog = TechnologyCatalogSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../catalog/seed/technology-catalog.json", import.meta.url),
      "utf-8",
    ),
  ),
);

type LookupResult = Awaited<ReturnType<typeof dnsLookup>>;
const PUBLIC_LOOKUP: LookupResult = [
  { address: "93.184.216.34", family: 4 },
] as unknown as LookupResult;

const { mockLookup } = vi.hoisted(() => ({
  mockLookup: vi.fn<typeof dnsLookup>(),
}));
vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

const { mockGetTechnologyCatalog } = vi.hoisted(() => ({
  mockGetTechnologyCatalog: vi.fn<typeof getTechnologyCatalog>(),
}));
vi.mock("@domainstack/catalog", () => ({
  getTechnologyCatalog: mockGetTechnologyCatalog,
}));

const { mockFetchDns } = vi.hoisted(() => ({
  mockFetchDns: vi.fn<typeof fetchDns>(),
}));
vi.mock("./dns", () => ({
  fetchDns: mockFetchDns,
}));

// Initialize PGlite before importing anything that uses the db.
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { fetchTechnologies } = await import("./technologies");
const { getCachedTechnologies } = await import("@domainstack/db/queries/technologies");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(async () => {
  server.close();
  await closePGliteDb();
});

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue(PUBLIC_LOOKUP);
  mockGetTechnologyCatalog.mockReset();
  mockGetTechnologyCatalog.mockResolvedValue(seedCatalog);
  mockFetchDns.mockReset();
  mockFetchDns.mockResolvedValue({ success: true, data: { records: [], resolver: "cloudflare" } });
});

describe("fetchTechnologies", () => {
  it("detects nginx, WordPress, and implied PHP end to end from the seed catalog", async () => {
    server.use(
      http.get("https://tech-nginx-wp.test/", () => {
        const headers = new Headers({
          "Content-Type": "text/html",
          Server: "nginx/1.25.3",
        });
        return new HttpResponse(
          '<html><head><meta name="generator" content="WordPress 6.5"></head><body></body></html>',
          { status: 200, headers },
        );
      }),
    );

    const result = await fetchTechnologies("tech-nginx-wp.test");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const nginx = result.data.technologies.find((t) => t.slug === "nginx");
    const wordpress = result.data.technologies.find((t) => t.slug === "wordpress");
    const php = result.data.technologies.find((t) => t.slug === "php");

    expect(nginx).toMatchObject({ version: "1.25.3", implied: false });
    expect(wordpress).toMatchObject({ version: "6.5", implied: false });
    expect(php).toMatchObject({ implied: true, version: null });
  });

  it("returns an empty technologies array with no error when the catalog is unavailable", async () => {
    mockGetTechnologyCatalog.mockResolvedValue(null);

    server.use(
      http.get(
        "https://tech-no-catalog.test/",
        () =>
          new HttpResponse("<html></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const result = await fetchTechnologies("tech-no-catalog.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.technologies).toEqual([]);
    expect(result.data.error).toBeUndefined();

    const cached = await getCachedTechnologies("tech-no-catalog.test");
    expect(cached.data?.technologies).toEqual([]);
  });

  it("detects PHP directly from a Set-Cookie PHPSESSID", async () => {
    server.use(
      http.get("https://tech-cookie.test/", () => {
        const headers = new Headers({ "Content-Type": "text/html" });
        headers.append("Set-Cookie", "PHPSESSID=abc123; Path=/");
        return new HttpResponse("<html></html>", { status: 200, headers });
      }),
    );

    const result = await fetchTechnologies("tech-cookie.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    const php = result.data.technologies.find((t) => t.slug === "php");
    expect(php).toMatchObject({ implied: false });
  });

  it("detects a technology from a DNS TXT record", async () => {
    mockFetchDns.mockResolvedValue({
      success: true,
      data: {
        records: [
          {
            type: "TXT",
            name: "tech-dns-txt.test",
            value: "google-site-verification=xyz",
          },
        ],
        resolver: "cloudflare",
      },
    });

    server.use(
      http.get(
        "https://tech-dns-txt.test/",
        () =>
          new HttpResponse("<html></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const result = await fetchTechnologies("tech-dns-txt.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    const gsc = result.data.technologies.find((t) => t.slug === "google-search-console");
    expect(gsc).toBeDefined();
  });

  it("still returns HTML-derived technologies when the DNS lookup fails", async () => {
    mockFetchDns.mockRejectedValue(new Error("dns lookup boom"));

    server.use(
      http.get("https://tech-dns-fail.test/", () => {
        const headers = new Headers({ "Content-Type": "text/html", Server: "nginx/1.25.3" });
        return new HttpResponse("<html></html>", { status: 200, headers });
      }),
    );

    const result = await fetchTechnologies("tech-dns-fail.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    const nginx = result.data.technologies.find((t) => t.slug === "nginx");
    expect(nginx).toBeDefined();
  });

  it("returns dns_error and persists an empty row when the page's own DNS resolution fails", async () => {
    mockLookup.mockResolvedValue([] as unknown as LookupResult);

    const result = await fetchTechnologies("tech-page-dns-fail.test");

    expect(result).toEqual({ success: false, error: "dns_error" });

    const cached = await getCachedTechnologies("tech-page-dns-fail.test");
    expect(cached.data?.technologies).toEqual([]);
    expect(cached.data?.error).toBe("DNS resolution failed");
  });

  it("returns success with an empty technologies array and records the error for a 404 homepage", async () => {
    server.use(
      http.get("https://tech-404.test/", () => new HttpResponse("Not Found", { status: 404 })),
    );

    const result = await fetchTechnologies("tech-404.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.technologies).toEqual([]);
    expect(result.data.error).toBe("HTTP 404");
  });

  it("resolves scriptSrc to an absolute URL and detects jQuery with its version", async () => {
    server.use(
      http.get(
        "https://tech-jquery.test/",
        () =>
          new HttpResponse(
            '<html><body><script src="/js/jquery-3.7.1.min.js"></script></body></html>',
            { status: 200, headers: { "Content-Type": "text/html" } },
          ),
      ),
    );

    const result = await fetchTechnologies("tech-jquery.test");

    expect(result.success).toBe(true);
    if (!result.success) return;
    const jquery = result.data.technologies.find((t) => t.slug === "jquery");
    expect(jquery).toMatchObject({ version: "3.7.1", implied: false });
  });
});
