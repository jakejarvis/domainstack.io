/**
 * Subscription quota view returned to the client.
 */

import type { Plan } from "./primitives";

export interface SubscriptionQuota {
  plan: Plan;
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
}
