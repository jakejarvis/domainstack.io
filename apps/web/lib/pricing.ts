import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "pricing" });

/**
 * Domain registration pricing service.
 *
 * Caching Strategy:
 * - Uses Next.js Data Cache with `fetch` configuration
 * - Automatic stale-while-revalidate (SWR): serves cached data instantly,
 *   revalidates in background when cache expires
 * - Cache TTLs: 7 days (Porkbun, Cloudflare, Dynadot)
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
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Fetch pricing data from the registrar API */
  fetchPricing: () => Promise<RegistrarPricingResponse>;
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Factory function to create a pricing provider with default configuration.
 */
function createPricingProvider(
  name: string,
  implementation: {
    fetchPricing: (
      fetchFn: (url: string, options?: RequestInit) => Promise<Response>,
    ) => Promise<RegistrarPricingResponse>;
  },
  config: PricingProviderConfig = {},
): PricingProvider {
  const revalidate = config.revalidate ?? 604_800; // 7 days
  const enabled = config.enabled ?? true;

  const providerFetch = async (
    url: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const res = await fetch(url, {
      ...options,
      next: { revalidate, tags: ["pricing", `pricing:${name}`] },
    });

    if (!res.ok) {
      logger.error({ provider: name, status: res.status }, "upstream error");
      throw new Error(`${name} API returned ${res.status}`);
    }

    return res;
  };

  return {
    name,
    enabled,
    fetchPricing: () => implementation.fetchPricing(providerFetch),
  };
}

// ============================================================================
// Provider Implementations
// ============================================================================

const porkbunProvider = createPricingProvider("porkbun", {
  async fetchPricing(fetchFn) {
    // Does not require authentication!
    // https://porkbun.com/api/json/v3/documentation#Domain%20Pricing
    const res = await fetchFn(
      "https://api.porkbun.com/api/json/v3/pricing/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );

    const data = await res.json();
    // Porkbun returns: { status: "SUCCESS", pricing: { "com": { ... }, ... } }
    return data.pricing as RegistrarPricingResponse;
  },
});

const cloudflareProvider = createPricingProvider("cloudflare", {
  async fetchPricing(fetchFn) {
    // Third-party API that aggregates Cloudflare pricing
    // https://cfdomainpricing.com/
    const res = await fetchFn("https://cfdomainpricing.com/prices.json", {
      headers: { Accept: "application/json" },
    });

    const data = await res.json();

    // Transform: { "com": { "registration": 10.44, ... }, ... } → normalized shape
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

const dynadotApiKey = process.env.DYNADOT_API_KEY;

const dynadotProvider = createPricingProvider(
  "dynadot",
  {
    async fetchPricing(fetchFn) {
      // API key presence checked at provider creation time via `enabled` flag
      const apiKey = dynadotApiKey as string;

      // https://www.dynadot.com/domain/api-document#domain_get_tld_price
      const url = new URL(
        "https://api.dynadot.com/restful/v1/domains/get_tld_price",
      );
      url.searchParams.set("currency", "USD");

      const res = await fetchFn(url.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      const data = await res.json();

      // Check for API errors (Dynadot returns 200 OK with error payloads)
      if (data?.code !== 200) {
        logger.error(
          {
            err: data?.error,
            provider: "dynadot",
          },
          "dynadot api error",
        );
        throw new Error(
          `Dynadot API error: ${data?.message ?? "Unknown error"}`,
        );
      }

      // Dynadot returns: { code: 200, data: { tldPriceList: [...] } }
      const pricing: RegistrarPricingResponse = {};
      for (const item of data?.data?.tldPriceList || []) {
        // Dynadot includes leading dot (e.g., ".com"), remove it
        const tld = item.tld?.toLowerCase().replace(/^\./, "");
        const registrationPrice = item.allYearsRegisterPrice?.[0];

        if (tld && registrationPrice !== undefined) {
          pricing[tld] = { registration: String(registrationPrice) };
        }
      }
      return pricing;
    },
  },
  { enabled: !!dynadotApiKey },
);

export const providers: PricingProvider[] = [
  porkbunProvider,
  cloudflareProvider,
  dynadotProvider,
];
