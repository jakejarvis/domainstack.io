/**
 * Domain pricing types.
 *
 * Constants are in @/lib/constants/pricing-providers.ts.
 */

export interface PricingProviderInfo {
  /** Provider display name */
  name: string;
  /** Generate registration URL for a domain */
  searchUrl: (domain: string) => string;
  /** Provider icon component */
  icon: React.ComponentType<{ className?: string }>;
}
