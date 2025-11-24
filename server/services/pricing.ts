import { getDomainTld } from "rdapper";
import { createLogger } from "@/lib/logger/server";
import type { Pricing } from "@/lib/schemas";

const logger = createLogger({ source: "pricing" });

/**
 * Domain registration pricing service.
 *
 * Caching Strategy:
 * - Uses Next.js Data Cache with `fetch` configuration
 * - Automatic stale-while-revalidate (SWR): serves cached data instantly,
 *   revalidates in background when cache expires
 * - Cache TTLs: 7 days (Porkbun and Cloudflare)
 * - No manual cron jobs needed - Next.js handles revalidation automatically
 * - Gracefully handles slow/failed API responses by returning null
 *
 * When registrar APIs are slow (common), users see cached pricing immediately
 * while fresh data fetches in the background. This provides the best UX.
 *
 * Extensibility:
 * - To add a new provider, call `createPricingProvider()` with metadata and implementation
 * - Configure timeout, cache TTL, and enabled state via the config parameter
 * - Add the provider to the `providers` array
 * - Use `createFetchWithTimeout()` helper for automatic timeout/error handling
 */

/**
 * Normalized pricing response shape that all registrars conform to.
 * Maps TLD to pricing information: { "com": { "registration": "10.99", ... }, ... }
 */
export type RegistrarPricingResponse = Record<
  string,
  { registration?: string; renewal?: string; transfer?: string }
>;

/**
 * Configuration options for pricing providers.
 */
export interface PricingProviderConfig {
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Cache revalidation period in seconds (default: 604800 = 7 days) */
  revalidate?: number;
  /** Whether to enable this provider (default: true) */
  enabled?: boolean;
}

/**
 * Generic pricing provider interface that each registrar implements.
 */
export interface PricingProvider {
  /** Provider name (must match key in PRICING_PROVIDERS constant) */
  name: string;
  /** Provider configuration */
  config: Required<PricingProviderConfig>;
  /** Fetch pricing data from the registrar API */
  fetchPricing: () => Promise<RegistrarPricingResponse>;
}

// ============================================================================
// Provider Helper Functions
// ============================================================================

/**
 * Create a fetch function with automatic timeout, error handling, and Next.js cache configuration.
 * Use this helper when implementing provider `fetchPricing` methods.
 */
export function createFetchWithTimeout(
  providerName: string,
  config: Required<PricingProviderConfig>,
) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        next: {
          revalidate: config.revalidate,
          tags: ["pricing", `pricing-${providerName}`],
        },
      });

      if (!res.ok) {
        logger.error("upstream error", undefined, {
          provider: providerName,
          status: res.status,
        });
        throw new Error(`${providerName} API returned ${res.status}`);
      }

      return res;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.error(`upstream timeout ${providerName}`, err, {
          provider: providerName,
        });
        throw new Error(`${providerName} API request timed out`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Factory function to create a pricing provider with default configuration.
 */
export function createPricingProvider(
  name: string,
  implementation: {
    fetchPricing: (
      fetchWithTimeout: ReturnType<typeof createFetchWithTimeout>,
    ) => Promise<RegistrarPricingResponse>;
  },
  config: PricingProviderConfig = {},
): PricingProvider {
  const resolvedConfig: Required<PricingProviderConfig> = {
    timeout: config.timeout ?? 60_000,
    revalidate: config.revalidate ?? 604_800, // 7 days
    enabled: config.enabled ?? true,
  };

  const fetchWithTimeout = createFetchWithTimeout(name, resolvedConfig);

  return {
    name,
    config: resolvedConfig,
    fetchPricing: () => implementation.fetchPricing(fetchWithTimeout),
  };
}

/**
 * Fetch pricing data from a provider with Next.js Data Cache.
 */
async function fetchProviderPricing(
  provider: PricingProvider,
): Promise<RegistrarPricingResponse | null> {
  // Skip disabled providers
  if (!provider.config.enabled) {
    logger.debug("provider disabled", { provider: provider.name });
    return null;
  }

  try {
    const payload = await provider.fetchPricing();
    logger.info("fetch ok", { provider: provider.name });
    return payload;
  } catch (err) {
    logger.error("fetch error", err, { provider: provider.name });
    return null;
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

const porkbunProvider = createPricingProvider("porkbun", {
  async fetchPricing(fetchWithTimeout) {
    // Does not require authentication!
    // https://porkbun.com/api/json/v3/documentation#Domain%20Pricing
    const res = await fetchWithTimeout(
      "https://api.porkbun.com/api/json/v3/pricing/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );

    const data = await res.json();
    // Porkbun returns: { status: "SUCCESS", pricing: { "com": { ... }, ... } }
    // Extract just the pricing data
    return data.pricing as RegistrarPricingResponse;
  },
});

const cloudflareProvider = createPricingProvider("cloudflare", {
  async fetchPricing(fetchWithTimeout) {
    // Third-party API that aggregates Cloudflare pricing
    // https://cfdomainpricing.com/
    const res = await fetchWithTimeout(
      "https://cfdomainpricing.com/prices.json",
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );

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
  },
});

const dynadotProvider = createPricingProvider("dynadot", {
  async fetchPricing(fetchWithTimeout) {
    // Requires API key from environment
    const apiKey = process.env.DYNADOT_API_KEY;

    if (!apiKey) {
      logger.warn("DYNADOT_API_KEY not set", { provider: "dynadot" });
      throw new Error("Dynadot API key not configured");
    }

    // Build URL with required query parameters
    // https://www.dynadot.com/domain/api-document#domain_get_tld_price
    const url = new URL(
      "https://api.dynadot.com/restful/v1/domains/get_tld_price",
    );
    url.searchParams.set("currency", "USD");

    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const data = await res.json();

    // Check for API errors
    if (data?.code !== 200) {
      logger.error("dynadot api error", undefined, {
        provider: "dynadot",
        code: data?.code,
        message: data?.message,
        error: data?.error,
      });
      throw new Error(`Dynadot API error: ${data?.message ?? "Unknown error"}`);
    }

    // Dynadot returns: { code: 200, message: "success", data: { tldPriceList: [...] } }
    const tldList = data?.data?.tldPriceList || [];
    const pricing: RegistrarPricingResponse = {};

    for (const item of tldList) {
      // Dynadot includes the leading dot (e.g., ".com"), so we need to remove it
      const tld = item.tld?.toLowerCase().replace(/^\./, "");
      // allYearsRegisterPrice is an array, get the first year price
      const registrationPrice = item.allYearsRegisterPrice?.[0];

      if (tld && registrationPrice !== undefined) {
        pricing[tld] = {
          registration: String(registrationPrice),
        };
      }
    }

    return pricing;
  },
});

/**
 * List of providers to check.
 * All enabled providers are queried in parallel.
 */
const providers: PricingProvider[] = [
  porkbunProvider,
  cloudflareProvider,
  dynadotProvider,
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch domain pricing for the given domain's TLD from all providers.
 * Returns pricing from all providers that have data for this TLD.
 */
export async function getPricing(domain: string): Promise<Pricing> {
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
        const price = payload?.[tld]?.registration ?? null;
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
