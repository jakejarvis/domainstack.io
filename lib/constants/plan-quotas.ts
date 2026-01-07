/**
 * User tiers for subscription plans.
 */
export const PLANS = ["free", "pro"] as const;

/**
 * Domain quotas per tier.
 */
export const PLAN_QUOTAS: Record<(typeof PLANS)[number], number> = {
  free: 5,
  pro: 100,
} as const;
