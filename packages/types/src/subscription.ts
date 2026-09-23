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

/**
 * Live billing details from Polar for the user's current subscription.
 */
export interface BillingDetails {
  /** In cents. */
  amount: number;
  /** Lowercase ISO 4217. */
  currency: string;
  interval: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}
