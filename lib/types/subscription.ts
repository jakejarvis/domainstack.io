/**
 * Subscription types - Plain TypeScript interfaces.
 *
 * These are internal data structures, no runtime validation needed.
 */

import type { USER_TIERS } from "@/lib/constants/plan-quotas";

export type UserTier = (typeof USER_TIERS)[number];

/**
 * Subscription plan type (alias for UserTier for clarity).
 */
export type SubscriptionPlan = UserTier;

/**
 * User subscription data returned from API.
 */
export interface Subscription {
  plan: SubscriptionPlan;
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
}
