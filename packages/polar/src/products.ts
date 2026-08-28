let missingProductIdsWarned = false;

/**
 * Resolve Polar product IDs from environment variables.
 *
 * Uses NEXT_PUBLIC_ prefix because these are needed client-side for checkout.
 *
 * IMPORTANT: this must NOT throw. It is reached at module-evaluation time via
 * `getProductsForCheckout()` inside the Better Auth `polar()` plugin config in
 * `@domainstack/auth/server`, which is imported app-wide — a throw here would
 * 500 every authenticated route. Missing IDs simply disable checkout (logged
 * once) instead of taking the app down.
 */
function getProductIds(): { monthlyId?: string; yearlyId?: string } {
  const monthlyId = process.env.NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID;
  const yearlyId = process.env.NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID;

  if ((!monthlyId || !yearlyId) && !missingProductIdsWarned) {
    missingProductIdsWarned = true;
    // `products.ts` is imported from client components (checkout UI). Do not
    // pull `@domainstack/logger` / pino-pretty into the browser bundle.
    console.warn(
      "Missing Polar product IDs (NEXT_PUBLIC_POLAR_MONTHLY_PRODUCT_ID / NEXT_PUBLIC_POLAR_YEARLY_PRODUCT_ID); checkout is disabled.",
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
    tier: "pro",
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
    tier: "pro",
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
 *
 * Products whose env-configured ID is missing are filtered out (rather than
 * throwing); an empty result means checkout is effectively disabled.
 */
export function getProductsForCheckout() {
  return Object.values(POLAR_PRODUCTS).flatMap((product) => {
    const productId = product.productId;
    return productId ? [{ productId, slug: product.slug }] : [];
  });
}

/**
 * Find Polar product config by Polar product ID.
 * Used by webhooks for tier assignment and analytics properties.
 */
export function getProductByProductId(productId: string) {
  return Object.values(POLAR_PRODUCTS).find((p) => p.productId === productId) ?? null;
}

/**
 * Find the tier associated with a Polar product ID.
 * Used by webhooks to determine which tier to assign.
 */
export function getTierForProductId(productId: string): "pro" | null {
  return getProductByProductId(productId)?.tier ?? null;
}

/**
 * Pro tier display info for UI components.
 * Use getProTierInfo() when you need the dynamic domain limit from the subscription.
 */
export const PRO_TIER_INFO = {
  name: "Pro",
  monthly: POLAR_PRODUCTS["pro-monthly"],
  yearly: POLAR_PRODUCTS["pro-yearly"],
} as const;
