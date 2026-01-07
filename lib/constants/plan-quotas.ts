/**
 * User tiers for subscription plans.
 */
export const USER_TIERS = ["free", "pro"] as const;

/**
 * Domain quotas per tier.
 */
export const PLAN_QUOTAS = {
  free: 5,
  pro: 100,
} as const;
