/**
 * Domain pricing types.
 *
 * Constants are in @/lib/constants/pricing-providers.ts.
 */

/**
 * Pricing from a single provider.
 */
export interface ProviderPricing {
  provider: string;
  price: string;
}

/**
 * Response from pricing lookup.
 */
export interface PricingResponse {
  tld: string | null;
  providers: ProviderPricing[];
}

export interface PricingProviderInfo {
  /** Provider display name */
  name: string;
  /** Generate registration URL for a domain */
  searchUrl: (domain: string) => string;
  /** Provider icon component */
  icon: React.ComponentType<{ className?: string }>;
}
