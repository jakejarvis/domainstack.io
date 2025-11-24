import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPricingForTld } from "./pricing";

// Mock the logger
vi.mock("@/lib/logger/server", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("pricing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPricingForTld", () => {
    it("should return null for invalid domains", async () => {
      const result = await getPricingForTld("localhost");
      expect(result).toEqual({ tld: null, providers: [] });
    });

    it("should return null for empty input", async () => {
      const result = await getPricingForTld("");
      expect(result).toEqual({ tld: null, providers: [] });
    });

    it("should extract TLD correctly", async () => {
      // Mock fetch to return successful Porkbun response
      const mockPorkbunResponse = {
        status: "SUCCESS",
        pricing: {
          com: { registration: "10.99", renewal: "12.99" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPorkbunResponse,
      });

      const result = await getPricingForTld("example.com");
      expect(result.tld).toBe("com");
    });

    it("should fetch from multiple providers in parallel", async () => {
      const mockPorkbunResponse = {
        status: "SUCCESS",
        pricing: {
          com: { registration: "10.99" },
        },
      };

      const mockCloudflareResponse = {
        com: { registration: 10.44, renewal: 10.44 },
      };

      // Mock fetch to return appropriate response based on URL
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("porkbun")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockPorkbunResponse,
          });
        }
        if (url.includes("cfdomainpricing")) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCloudflareResponse,
          });
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const result = await getPricingForTld("example.com");
      expect(result.providers).toHaveLength(2);
      expect(result.providers).toContainEqual({
        provider: "porkbun",
        price: "10.99",
      });
      expect(result.providers).toContainEqual({
        provider: "cloudflare",
        price: "10.44",
      });
    });

    it("should handle provider failures gracefully", async () => {
      // Mock fetch to fail for the first provider but succeed for the second
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            com: { registration: 10.44 },
          }),
        });
      });

      const result = await getPricingForTld("example.com");
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].provider).toBe("cloudflare");
    });

    it("should return empty providers array when no providers have pricing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pricing: {} }),
      });

      const result = await getPricingForTld("example.xyz");
      expect(result.tld).toBe("xyz");
      expect(result.providers).toEqual([]);
    });
  });
});
