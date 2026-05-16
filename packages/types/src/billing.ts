/**
 * Provider-agnostic billing seam.
 *
 * A `BillingProvider` translates provider-native subscription events into a
 * normalized upsert + side-effect classification, and reconciles a user's
 * authoritative state. The entitlement layer (`recomputeEntitlement`) derives
 * the cached `userSubscriptions.tier`/`endsAt` from all providers' rows —
 * providers never write tier directly.
 */

import type { BillingProviderId, BillingSubscriptionStatus } from "@domainstack/constants";

/**
 * Normalized snapshot of one subscription, keyed by (provider, externalId).
 * This is exactly the shape upserted into `billing_subscriptions` before
 * `recomputeEntitlement`.
 *
 * - `externalId` is our user id (Polar `customer.externalId`).
 * - `productId` null still grants pro (single paid tier model).
 */
export interface BillingSubscriptionUpsert {
  provider: BillingProviderId;
  externalId: string;
  providerSubscriptionId: string;
  productId: string | null;
  status: BillingSubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Side-effect classification so email sending stays out of the provider.
 * The handler/dispatcher decides which email to send from this.
 */
export type BillingSideEffect =
  | { kind: "upgrade" }
  | { kind: "canceling"; periodEnd: Date }
  | { kind: "expired" }
  | { kind: "none" };

/**
 * Result of normalizing one provider-native event. `upsert: null` (or
 * `userId: null`) means "ignore this event" (e.g. no externalId, or a
 * log-only `created` event).
 */
export interface NormalizedBillingEvent {
  userId: string | null;
  upsert: BillingSubscriptionUpsert | null;
  sideEffect: BillingSideEffect;
}

/**
 * Authoritative reconciliation state. Generalizes Polar's
 * `CustomerSubscriptionState` verbatim (structurally identical):
 * `unknown` means the lookup failed and callers MUST NOT perform a
 * destructive action (the cron reconciles later).
 */
export type BillingReconcileState =
  | { status: "ok"; hasActiveSubscription: boolean; hasNonCancelingActive: boolean }
  | { status: "unknown" };

/**
 * A billing provider (Polar today; Apple/Google/RevenueCat on the roadmap).
 * Transport (webhook/HTTP/notification) lives at the edge and only ever calls
 * `normalizeEvent`; the interface itself is transport-agnostic.
 */
export interface BillingProvider<TEvent = unknown> {
  readonly provider: BillingProviderId;
  normalizeEvent(event: TEvent): NormalizedBillingEvent | Promise<NormalizedBillingEvent>;
  reconcile(userId: string): Promise<BillingReconcileState>;
}
