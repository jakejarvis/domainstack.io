import type { UserTier } from "@/lib/schemas";

/**
 * Get Polar product IDs from environment variables with validation.
 * These are required and must be set for the application to function.
 *
 * Uses NEXT_PUBLIC_ prefix because these are needed client-side for checkout.
 */
function getProductIds() {
  const monthlyId = process.env.NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID;
  const yearlyId = process.env.NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID;

  if (!monthlyId || !yearlyId) {
    throw new Error(
      "Missing required Polar product IDs. Set NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID and NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID environment variables.",
    );
  }

  return { monthlyId, yearlyId };
}

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
    get productId() {
      return getProductIds().monthlyId;
    },
    slug: "pro-monthly",
    tier: "pro" as UserTier,
    name: "Pro Monthly",
    interval: "month" as const,
    amount: 200, // $2/month
    label: "$2/month",
  },
  "pro-yearly": {
    get productId() {
      return getProductIds().yearlyId;
    },
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
  const product = Object.values(POLAR_PRODUCTS).find(
    (p) => p.productId === productId,
  );
  return product?.tier ?? null;
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
 * Use this when you have access to the proMaxDomains from getSubscription query.
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
