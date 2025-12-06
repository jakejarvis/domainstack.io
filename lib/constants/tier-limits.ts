/**
 * Default domain tracking limits by tier.
 * These are fallback values used when Edge Config is not available.
 *
 * To configure dynamically without redeployment, set these in Vercel Edge Config:
 * ```json
 * {
 *   "tier_limits": {
 *     "free": 5,
 *     "pro": 50
 *   }
 * }
 * ```
 */
export const DEFAULT_TIER_LIMITS = {
  free: 5,
  pro: 50,
} as const;

export type TierLimits = {
  [K in keyof typeof DEFAULT_TIER_LIMITS]: number;
};
