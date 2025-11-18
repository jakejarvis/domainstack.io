"use cache";

import { getDomainTld } from "rdapper";
import type { Pricing } from "@/lib/schemas";

/**
 * Domain registration pricing service.
 *
 * Caching Strategy:
 * - Uses Next.js 16 Data Cache with "use cache" directive
 * - Automatic stale-while-revalidate (SWR): serves cached data instantly,
 *   revalidates in background when cache expires
 * - Cache TTLs: 7 days (Porkbun and Cloudflare)
 * - No manual cron jobs needed - Next.js handles revalidation automatically
 * - Gracefully handles slow/failed API responses by returning null
 *
 * When registrar APIs are slow (common), users see cached pricing immediately
 * while fresh data fetches in the background. This provides the best UX.
 */

/**
 * Normalized pricing response shape that all registrars conform to.
 * Maps TLD to pricing information: { "com": { "registration": "10.99", ... }, ... }
 */
type RegistrarPricingResponse = Record<
  string,
  { registration?: string; renewal?: string; transfer?: string }
>;

/**
 * Generic pricing provider interface that each registrar implements.
 */
interface PricingProvider {
  /** Provider name for logging */
  name: string;
  /** How long to cache the pricing data (seconds) */
  cacheTtlSeconds: number;
  /** Fetch pricing data from the registrar API */
  fetchPricing: () => Promise<RegistrarPricingResponse>;
  /** Extract the registration price for a specific TLD from the response */
  extractPrice: (
    response: RegistrarPricingResponse,
    tld: string,
  ) => string | null;
}

/**
 * Fetch pricing data from a provider with Next.js Data Cache.
 * Uses Next.js 16's "use cache" directive for automatic caching.
 */
async function fetchProviderPricing(
  provider: PricingProvider,
): Promise<RegistrarPricingResponse | null> {
  try {
    const payload = await provider.fetchPricing();
    console.info(`[pricing] fetch ok ${provider.name}`);
    return payload;
  } catch (err) {
    console.error(
      `[pricing] fetch error ${provider.name}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    return null;
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

const porkbunProvider: PricingProvider = {
  name: "porkbun",
  cacheTtlSeconds: 7 * 24 * 60 * 60, // 7 days

  async fetchPricing(): Promise<RegistrarPricingResponse> {
    // Does not require authentication!
    // https://porkbun.com/api/json/v3/documentation#Domain%20Pricing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60 second timeout

    try {
      const res = await fetch(
        "https://api.porkbun.com/api/json/v3/pricing/get",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
          next: {
            revalidate: this.cacheTtlSeconds,
            tags: ["pricing", "pricing-porkbun"],
          },
        },
      );

      if (!res.ok) {
        console.error(`[pricing] upstream error porkbun status=${res.status}`);
        throw new Error(`Porkbun API returned ${res.status}`);
      }

      const data = await res.json();
      // Porkbun returns: { status: "SUCCESS", pricing: { "com": { ... }, ... } }
      // Extract just the pricing data
      return data.pricing as RegistrarPricingResponse;
    } catch (err) {
      // Translate AbortError into a retryable timeout error
      if (err instanceof Error && err.name === "AbortError") {
        console.error("[pricing] upstream timeout porkbun");
        throw new Error("Porkbun API request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  extractPrice(response: RegistrarPricingResponse, tld: string): string | null {
    return response?.[tld]?.registration ?? null;
  },
};

const cloudflareProvider: PricingProvider = {
  name: "cloudflare",
  cacheTtlSeconds: 7 * 24 * 60 * 60, // 7 days

  async fetchPricing(): Promise<RegistrarPricingResponse> {
    // Third-party API that aggregates Cloudflare pricing
    // https://cfdomainpricing.com/
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60 second timeout

    try {
      const res = await fetch("https://cfdomainpricing.com/prices.json", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        next: {
          revalidate: this.cacheTtlSeconds,
          tags: ["pricing", "pricing-cloudflare"],
        },
      });

      if (!res.ok) {
        console.error(
          `[pricing] upstream error cloudflare status=${res.status}`,
        );
        throw new Error(`Cloudflare pricing API returned ${res.status}`);
      }

      const data = await res.json();

      // Transform the response to match our normalized shape
      // cfdomainpricing.com returns: { "com": { "registration": 10.44, "renewal": 10.44 }, ... }
      const pricing: RegistrarPricingResponse = {};

      for (const [tld, prices] of Object.entries(data)) {
        if (
          typeof prices === "object" &&
          prices !== null &&
          "registration" in prices
        ) {
          pricing[tld] = {
            registration: String(
              (prices as { registration: string | number }).registration,
            ),
          };
        }
      }

      return pricing;
    } catch (err) {
      // Translate AbortError into a retryable timeout error
      if (err instanceof Error && err.name === "AbortError") {
        console.error("[pricing] upstream timeout cloudflare");
        throw new Error("Cloudflare pricing API request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  extractPrice(response: RegistrarPricingResponse, tld: string): string | null {
    return response?.[tld]?.registration ?? null;
  },
};

/**
 * List of providers to check in order of preference.
 * First provider with valid pricing wins.
 */
const providers: PricingProvider[] = [porkbunProvider, cloudflareProvider];

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch domain pricing for the given domain's TLD from all providers.
 * Returns pricing from all providers that have data for this TLD.
 */
export async function getPricingForTld(domain: string): Promise<Pricing> {
  const input = (domain ?? "").trim().toLowerCase();
  // Ignore single-label hosts like "localhost" or invalid inputs
  if (!input.includes(".")) return { tld: null, providers: [] };

  const tld = getDomainTld(input)?.toLowerCase() ?? "";
  if (!tld) return { tld: null, providers: [] };

  // Fetch pricing from all providers in parallel
  const providerResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const payload = await fetchProviderPricing(provider);
      if (payload) {
        const price = provider.extractPrice(payload, tld);
        if (price) {
          return { provider: provider.name, price };
        }
      }
      return null;
    }),
  );

  // Filter out rejected promises and null results
  const availableProviders = providerResults
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        provider: string;
        price: string;
      } | null> => result.status === "fulfilled",
    )
    .map((result) => result.value)
    .filter(
      (result): result is { provider: string; price: string } =>
        result !== null,
    );

  return { tld, providers: availableProviders };
}
