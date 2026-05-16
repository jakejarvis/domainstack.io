/**
 * Billing providers. Source of truth for the `billing_provider` pgEnum.
 *
 * All values are listed now so the pgEnum is forward-stable: Postgres
 * `ALTER TYPE ... ADD VALUE` cannot run inside a transaction and Drizzle wraps
 * each migration file in one, so listing the values up front avoids that future
 * friction. Only "polar" is wired in Phase 1.
 */
export const BILLING_PROVIDERS = ["polar", "apple", "google", "revenuecat"] as const;

export type BillingProviderId = (typeof BILLING_PROVIDERS)[number];

/**
 * Minimal, provider-neutral subscription lifecycle. Only `active` and
 * `canceling` (while still inside the paid period) grant the pro entitlement.
 */
export const BILLING_SUBSCRIPTION_STATUSES = [
  "active", // paid, entitling, not scheduled to cancel
  "canceling", // entitling until currentPeriodEnd, will not renew
  "expired", // no longer entitling (revoked / period elapsed)
  "incomplete", // created, payment unconfirmed — grants nothing
] as const;

export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];
