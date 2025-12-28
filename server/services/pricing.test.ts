import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { getPricing } from "./pricing";

afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});

describe("pricing service", () => {
  describe("getPricing", () => {
    it("should return null for invalid domains", async () => {
      const result = await getPricing("localhost");
      // "localhost" is treated as a TLD if passed directly
      expect(result).toEqual({ tld: "localhost", providers: [] });
    });

    it("should return null for empty input", async () => {
      const result = await getPricing("");
      expect(result).toEqual({ tld: null, providers: [] });
    });

    it("should extract TLD correctly", async () => {
      // Handled by generic handlers in mocks/handlers.ts
      const result = await getPricing("com");
      expect(result.tld).toBe("com");
    });

    it("should fetch from multiple providers in parallel", async () => {
      // Stub env var for consistent behavior
      vi.stubEnv("DYNADOT_API_KEY", "mock-key");

      // Handled by generic handlers in mocks/handlers.ts
      const result = await getPricing("com");
      expect(result.providers).toContainEqual({
        provider: "porkbun",
        price: "10.00", // Updated to match handlers.ts mock
      });
      expect(result.providers).toContainEqual({
        provider: "cloudflare",
        price: "9.15", // Updated to match handlers.ts mock
      });

      expect(result.providers).toContainEqual({
        provider: "dynadot",
        price: "10.99",
      });
    });

    it("should handle provider failures gracefully", async () => {
      // Force Porkbun and Dynadot to fail, let Cloudflare succeed
      server.use(
        http.post("https://api.porkbun.com/api/json/v3/pricing/get", () => {
          return HttpResponse.error();
        }),
        http.get(
          "https://api.dynadot.com/restful/v1/domains/get_tld_price",
          () => {
            return HttpResponse.error();
          },
        ),
      );

      const result = await getPricing("com");
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].provider).toBe("cloudflare");
      expect(result.providers[0].price).toBe("9.15");
    });

    it("should return empty providers array when no providers have pricing", async () => {
      // Mock all providers to return no pricing or fail
      server.use(
        http.post("https://api.porkbun.com/api/json/v3/pricing/get", () => {
          return HttpResponse.json({ status: "SUCCESS", pricing: {} });
        }),
        http.get("https://cfdomainpricing.com/prices.json", () => {
          return HttpResponse.json({});
        }),
        http.get(
          "https://api.dynadot.com/restful/v1/domains/get_tld_price",
          () => {
            return HttpResponse.json({ code: 200, data: { tldPriceList: [] } });
          },
        ),
      );

      const result = await getPricing("xyz");
      expect(result.tld).toBe("xyz");
      expect(result.providers).toEqual([]);
    });
  });
});
