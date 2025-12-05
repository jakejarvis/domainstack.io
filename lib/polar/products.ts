import type { UserTier } from "@/lib/schemas";

/**
 * Polar product configuration.
 *
 * Polar requires separate products for each billing interval (monthly vs yearly).
 * Create these products in the Polar dashboard and update the IDs here.
 *
 * - Sandbox: https://sandbox.polar.sh
 * - Production: https://polar.sh
 *
 * Price amounts are in cents (200 = $2.00).
 */
export const POLAR_PRODUCTS = {
  "pro-monthly": {
    productId: "bc96d339-45e0-41e9-8877-cfdcc689977e",
    slug: "pro-monthly",
    tier: "pro" as UserTier,
    name: "Pro Monthly",
    interval: "month" as const,
    amount: 200, // $2/month
    label: "$2/month",
  },
  "pro-yearly": {
    productId: "894304fc-8f36-43ac-9e90-7a70abd81671",
    slug: "pro-yearly",
    tier: "pro" as UserTier,
    name: "Pro Yearly",
    interval: "year" as const,
    amount: 2000, // $20/year
    label: "$20/year",
    savings: "Save ~17%",
  },
} as const;

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
 */
export const PRO_TIER_INFO = {
  name: "Pro",
  description: "Track up to 50 domains with advanced monitoring",
  features: [
    "Track up to 50 domains",
    "Priority email notifications",
    "Support development",
  ],
  monthly: POLAR_PRODUCTS["pro-monthly"],
  yearly: POLAR_PRODUCTS["pro-yearly"],
} as const;
