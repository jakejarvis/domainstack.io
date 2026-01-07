/**
 * Subscription types - Plain TypeScript interfaces.
 *
 * These are internal data structures, no runtime validation needed.
 */

import type { PLANS } from "@/lib/constants/plan-quotas";

/**
 * User subscription data returned from API.
 */
export interface Subscription {
  plan: (typeof PLANS)[number];
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
}
