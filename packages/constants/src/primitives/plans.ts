/**
 * User tiers for subscription plans.
 */
export const PLANS = ["free", "pro"] as const;

export type Plan = (typeof PLANS)[number];

/**
 * Domain quotas per tier.
 */
export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 5,
  pro: 100,
} as const;
