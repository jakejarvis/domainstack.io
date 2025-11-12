/* @vitest-environment node */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let getPricingForTld: typeof import("./pricing").getPricingForTld;
let refreshAllProviderPricing: typeof import("./pricing").refreshAllProviderPricing;

// Mock registrar pricing responses (standardized format)
const mockPorkbunResponse = {
  com: { registration: "9.99", renewal: "10.99" },
  dev: { registration: "12.00", renewal: "12.00" },
  org: { registration: "11.50" },
};

const mockCloudflareResponse = {
  com: { registration: "10.44" },
  dev: { registration: "13.50" },
  net: { registration: "12.88" },
};

describe("pricing service", () => {
  beforeAll(async () => {
    const { makeInMemoryRedis } = await import("@/lib/redis-mock");
    const impl = makeInMemoryRedis();
    vi.doMock("@/lib/redis", () => impl);
    const module = await import("./pricing");
    getPricingForTld = module.getPricingForTld;
    refreshAllProviderPricing = module.refreshAllProviderPricing;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const { resetInMemoryRedis } = await import("@/lib/redis-mock");
    resetInMemoryRedis();
  });

  describe("getPricingForTld", () => {
    it("returns empty providers for single-label hosts", async () => {
      const res = await getPricingForTld("localhost");
      expect(res.tld).toBeNull();
      expect(res.providers).toEqual([]);
    });

    it("returns empty providers for empty input", async () => {
      const res = await getPricingForTld("");
      expect(res.tld).toBeNull();
      expect(res.providers).toEqual([]);
    });

    it("fetches from all providers and caches responses on miss", async () => {
      // Mock both Porkbun and Cloudflare APIs (raw formats)
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "SUCCESS",
            pricing: mockPorkbunResponse,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCloudflareResponse,
        } as unknown as Response);

      const res = await getPricingForTld("example.com");

      expect(res.tld).toBe("com");
      expect(res.providers).toHaveLength(2);
      expect(res.providers).toContainEqual({
        provider: "porkbun",
        price: "9.99",
      });
      expect(res.providers).toContainEqual({
        provider: "cloudflare",
        price: "10.44",
      });

      // Verify both caches were set
      const { redis } = await import("@/lib/redis");
      expect(await redis.exists("pricing:porkbun")).toBe(1);
      expect(await redis.exists("pricing:cloudflare")).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("uses cached provider data without fetching again", async () => {
      // Seed cache with both provider data
      const { redis } = await import("@/lib/redis");
      await redis.set("pricing:porkbun", mockPorkbunResponse);
      await redis.set("pricing:cloudflare", mockCloudflareResponse);

      const fetchSpy = vi.spyOn(global, "fetch");
      const res = await getPricingForTld("something.dev");

      expect(res.tld).toBe("dev");
      expect(res.providers).toHaveLength(2);
      expect(res.providers).toContainEqual({
        provider: "porkbun",
        price: "12.00",
      });
      expect(res.providers).toContainEqual({
        provider: "cloudflare",
        price: "13.50",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("handles upstream API error gracefully", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as unknown as Response);

      const res = await getPricingForTld("example.com");
      expect(res.tld).toBe("com");
      expect(res.providers).toEqual([]);
    });

    it("handles network fetch error gracefully", async () => {
      vi.spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockRejectedValueOnce(new Error("Network timeout"));

      const res = await getPricingForTld("example.org");
      expect(res.tld).toBe("org");
      expect(res.providers).toEqual([]);
    });

    it("returns empty providers when TLD is not found in any provider response", async () => {
      // Seed cache with data that doesn't include .xyz
      const { redis } = await import("@/lib/redis");
      await redis.set("pricing:porkbun", mockPorkbunResponse);
      await redis.set("pricing:cloudflare", mockCloudflareResponse);

      const res = await getPricingForTld("example.xyz");
      expect(res.tld).toBe("xyz");
      expect(res.providers).toEqual([]);
    });

    it("normalizes domain input (case, whitespace)", async () => {
      const { redis } = await import("@/lib/redis");
      await redis.set("pricing:porkbun", mockPorkbunResponse);
      await redis.set("pricing:cloudflare", mockCloudflareResponse);

      const res = await getPricingForTld("  EXAMPLE.COM  ");
      expect(res.tld).toBe("com");
      expect(res.providers).toHaveLength(2);
      expect(res.providers).toContainEqual({
        provider: "porkbun",
        price: "9.99",
      });
      expect(res.providers).toContainEqual({
        provider: "cloudflare",
        price: "10.44",
      });
    });

    it("handles subdomains correctly by extracting TLD", async () => {
      const { redis } = await import("@/lib/redis");
      await redis.set("pricing:porkbun", mockPorkbunResponse);
      await redis.set("pricing:cloudflare", mockCloudflareResponse);

      const res = await getPricingForTld("www.example.dev");
      expect(res.tld).toBe("dev");
      expect(res.providers).toHaveLength(2);
      expect(res.providers).toContainEqual({
        provider: "porkbun",
        price: "12.00",
      });
      expect(res.providers).toContainEqual({
        provider: "cloudflare",
        price: "13.50",
      });
    });
  });

  describe("refreshAllProviderPricing", () => {
    it("successfully refreshes all providers and populates cache", async () => {
      // Mock both Porkbun and Cloudflare APIs (raw formats)
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "SUCCESS",
            pricing: mockPorkbunResponse,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCloudflareResponse,
        } as unknown as Response);

      const result = await refreshAllProviderPricing();

      expect(result.refreshed).toEqual(["porkbun", "cloudflare"]);
      expect(result.failed).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify both caches were populated
      const { redis } = await import("@/lib/redis");
      const porkbunCached = await redis.get("pricing:porkbun");
      expect(porkbunCached).toEqual(mockPorkbunResponse);
      const cloudflareCached = await redis.get("pricing:cloudflare");
      expect(cloudflareCached).toEqual(mockCloudflareResponse);
    });

    it("handles API errors and reports failed providers", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        } as unknown as Response);

      const result = await refreshAllProviderPricing();

      expect(result.refreshed).toEqual([]);
      expect(result.failed).toEqual(["porkbun", "cloudflare"]);

      // Verify caches were not populated
      const { redis } = await import("@/lib/redis");
      expect(await redis.exists("pricing:porkbun")).toBe(0);
      expect(await redis.exists("pricing:cloudflare")).toBe(0);
    });

    it("handles network errors and reports failed providers", async () => {
      vi.spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await refreshAllProviderPricing();

      expect(result.refreshed).toEqual([]);
      expect(result.failed).toEqual(["porkbun", "cloudflare"]);
    });

    it("refreshes even when cache already exists", async () => {
      // Pre-populate cache with old data
      const { redis } = await import("@/lib/redis");
      const oldData = { com: { registration: "8.88" } };
      await redis.set("pricing:porkbun", oldData);
      await redis.set("pricing:cloudflare", oldData);

      // Mock APIs with new data (raw formats)
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "SUCCESS",
            pricing: mockPorkbunResponse,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCloudflareResponse,
        } as unknown as Response);

      const result = await refreshAllProviderPricing();

      expect(result.refreshed).toEqual(["porkbun", "cloudflare"]);
      expect(result.failed).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify caches were updated with new data
      const porkbunCached = await redis.get("pricing:porkbun");
      expect(porkbunCached).toEqual(mockPorkbunResponse);
      expect(porkbunCached).not.toEqual(oldData);
    });
  });

  describe("getPricingForTld - negative caching", () => {
    it("returns pricing successfully from API and caches it", async () => {
      const { redis } = await import("@/lib/redis");

      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "SUCCESS",
            pricing: mockPorkbunResponse,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCloudflareResponse,
        } as unknown as Response);

      await getPricingForTld("example.com");

      // Verify pricing data was cached
      const porkbunCached = await redis.get("pricing:porkbun");
      expect(porkbunCached).toEqual(mockPorkbunResponse);
      const cloudflareCached = await redis.get("pricing:cloudflare");
      expect(cloudflareCached).toEqual(mockCloudflareResponse);
    });

    it("caches null value with short TTL when fetch fails", async () => {
      const { redis } = await import("@/lib/redis");

      vi.spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      await getPricingForTld("example.com");

      // Verify negative cache (null) was set to prevent repeated failed fetches
      const porkbunCached = await redis.get("pricing:porkbun");
      expect(porkbunCached).toBeNull();
      const cloudflareCached = await redis.get("pricing:cloudflare");
      expect(cloudflareCached).toBeNull();
    });

    it("sets negative cache with short TTL on fetch error", async () => {
      const { redis } = await import("@/lib/redis");

      vi.spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("API down"))
        .mockRejectedValueOnce(new Error("API down"));

      await getPricingForTld("example.com");

      // Verify negative cache was set for both providers
      const porkbunCached = await redis.get("pricing:porkbun");
      expect(porkbunCached).toBeNull();
      const cloudflareCached = await redis.get("pricing:cloudflare");
      expect(cloudflareCached).toBeNull();

      // Verify TTL is short (should be 60 seconds for negative cache)
      const porkbunTtl = await redis.ttl("pricing:porkbun");
      expect(porkbunTtl).toBeGreaterThan(0);
      expect(porkbunTtl).toBeLessThanOrEqual(60);
    });
  });
});
