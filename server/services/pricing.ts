import { after } from "next/server";
import { getDomainTld } from "rdapper";
import { ns, redis } from "@/lib/redis";
import type { Pricing } from "@/lib/schemas";

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
  /** Redis key for cached pricing data */
  cacheKey: string;
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
 * Generic function to fetch and cache pricing data from any provider.
 * Uses simple fail-open caching without distributed locks.
 */
async function fetchProviderPricing(
  provider: PricingProvider,
): Promise<RegistrarPricingResponse | null> {
  // Try cache first
  const cached = await redis
    .get<RegistrarPricingResponse | "error">(provider.cacheKey)
    .catch((err) => {
      console.error(
        `[pricing] cache read error ${provider.name}`,
        { cacheKey: provider.cacheKey },
        err instanceof Error ? err : new Error(String(err)),
      );
      return null;
    });
  if (cached && cached !== "error") return cached;
  if (cached === "error") {
    console.debug(`[pricing] cached failure ${provider.name}`);
    return null;
  }

  // Fetch fresh pricing
  try {
    const payload = await provider.fetchPricing();
    // Cache for next time
    after(() => {
      redis
        .set(provider.cacheKey, payload, { ex: provider.cacheTtlSeconds })
        .catch((err) => {
          console.error(
            `[pricing] cache write error ${provider.name}`,
            { cacheKey: provider.cacheKey },
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    });
    console.info(`[pricing] fetch ok ${provider.name} (not cached)`);
    return payload;
  } catch (err) {
    console.error(
      `[pricing] fetch error ${provider.name}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    // Short TTL negative cache
    after(() => {
      redis.set(provider.cacheKey, "error", { ex: 60 }).catch((cacheErr) => {
        console.error(
          `[pricing] negative cache write error ${provider.name}`,
          { cacheKey: provider.cacheKey },
          cacheErr instanceof Error ? cacheErr : new Error(String(cacheErr)),
        );
      });
    });
    return null;
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

const porkbunProvider: PricingProvider = {
  name: "porkbun",
  cacheKey: ns("pricing:porkbun"),
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
  cacheKey: ns("pricing:cloudflare"),
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

/**
 * Proactively refresh pricing data from all providers.
 * Called by the daily cron job to keep cache warm.
 * Runs all provider refreshes in parallel for efficiency.
 */
export async function refreshAllProviderPricing(): Promise<{
  refreshed: string[];
  failed: string[];
}> {
  const refreshed: string[] = [];
  const failed: string[] = [];

  // Run all provider refreshes in parallel
  const tasks = providers.map(async (provider) => {
    try {
      const payload = await provider.fetchPricing();
      await redis.set(provider.cacheKey, payload, {
        ex: provider.cacheTtlSeconds,
      });
      return { name: provider.name, success: true as const };
    } catch (err) {
      return { name: provider.name, success: false as const, error: err };
    }
  });

  const results = await Promise.allSettled(tasks);

  // Process results and emit logs
  for (const result of results) {
    if (result.status === "fulfilled") {
      const { name, success, error } = result.value;
      if (success) {
        refreshed.push(name);
        console.info(`[pricing] refresh ok ${name}`);
      } else {
        failed.push(name);
        console.error(`[pricing] refresh failed ${name}`, error);
      }
    } else {
      // Promise itself was rejected (shouldn't happen with our error handling)
      console.error("[pricing] refresh unexpected", result.reason);
    }
  }

  return { refreshed, failed };
}
