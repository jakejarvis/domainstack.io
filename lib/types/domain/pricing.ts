/**
 * Pricing types - Plain TypeScript interfaces.
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
