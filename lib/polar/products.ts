import type { UserTier } from "@/lib/schemas";

/**
 * Polar product IDs from environment variables.
 * These allow different product IDs for staging vs production environments.
 *
 * Fallbacks are the production Polar product IDs.
 */
const POLAR_MONTHLY_PRODUCT_ID =
  process.env.POLAR_MONTHLY_PRODUCT_ID ??
  "bc96d339-45e0-41e9-8877-cfdcc689977e";
const POLAR_YEARLY_PRODUCT_ID =
  process.env.POLAR_YEARLY_PRODUCT_ID ?? "894304fc-8f36-43ac-9e90-7a70abd81671";

/**
 * Polar product configuration.
 *
 * Polar requires separate products for each billing interval (monthly vs yearly).
 * Create these products in the Polar dashboard and set the IDs via environment variables.
 *
 * - Sandbox: https://sandbox.polar.sh
 * - Production: https://polar.sh
 *
 * Price amounts are in cents (200 = $2.00).
 */
export const POLAR_PRODUCTS = {
  "pro-monthly": {
    productId: POLAR_MONTHLY_PRODUCT_ID,
    slug: "pro-monthly",
    tier: "pro" as UserTier,
    name: "Pro Monthly",
    interval: "month" as const,
    amount: 200, // $2/month
    label: "$2/month",
  },
  "pro-yearly": {
    productId: POLAR_YEARLY_PRODUCT_ID,
    slug: "pro-yearly",
    tier: "pro" as UserTier,
    name: "Pro Yearly",
    interval: "year" as const,
    amount: 2000, // $20/year
    label: "$20/year",
    savings: "Save ~17%",
  },
};

export type ProductSlug = keyof typeof POLAR_PRODUCTS;

/**
 * Get product config by slug.
 */
export function getProduct(slug: ProductSlug) {
  return POLAR_PRODUCTS[slug];
}

/**
 * Get all products as an array for checkout config.
 */
export function getProductsForCheckout() {
  return Object.values(POLAR_PRODUCTS).map((product) => ({
    productId: product.productId,
    slug: product.slug,
  }));
}

/**
 * Get all products for a specific tier.
 */
export function getProductsForTier(tier: UserTier) {
  return Object.values(POLAR_PRODUCTS).filter((p) => p.tier === tier);
}

/**
 * Find the tier associated with a Polar product ID.
 * Used by webhooks to determine which tier to assign.
 */
export function getTierForProductId(productId: string): UserTier | null {
  for (const product of Object.values(POLAR_PRODUCTS)) {
    if (product.productId === productId) {
      return product.tier;
    }
  }
  return null;
}

/**
 * Pro tier display info for UI components.
 * Use getProTierInfo() when you need dynamic limit from Edge Config.
 */
export const PRO_TIER_INFO = {
  name: "Pro",
  monthly: POLAR_PRODUCTS["pro-monthly"],
  yearly: POLAR_PRODUCTS["pro-yearly"],
} as const;

/**
 * Get Pro tier info with dynamic domain limit.
 * Use this when you have access to the proMaxDomains from getLimits query.
 */
export function getProTierInfo(proMaxDomains: number) {
  return {
    ...PRO_TIER_INFO,
    description: `Track up to ${proMaxDomains} domains with advanced monitoring`,
    features: [
      `Track up to ${proMaxDomains} domains`,
      "Priority email notifications",
      "Support development",
    ],
  };
}
