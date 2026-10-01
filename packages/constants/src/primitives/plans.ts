/**
 * User tiers for subscription plans.
 */
export const PLANS = ["free", "pro"] as const;

type Plan = (typeof PLANS)[number];

/**
 * Domain quotas per tier.
 */
export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 5,
  pro: 100,
} as const;

/**
 * Hard cap on tracked-domain rows per user, archived included. Archiving frees
 * quota, so without this an account could grow rows (and auto-verify runs) forever.
 * Twice the Pro quota leaves room for a downgraded Pro account's archive.
 */
export const MAX_TRACKED_DOMAIN_ROWS = PLAN_QUOTAS.pro * 2;
