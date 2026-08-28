import { createLogger } from "@domainstack/logger";

import { polarClient } from "./server";

const logger = createLogger({ source: "polar/reconcile" });

/**
 * Authoritative subscription state for a customer, fetched live from Polar.
 *
 * Polar (Standard Webhooks) delivers events at-least-once and can reorder them.
 * Trusting a single event payload lets a stale/duplicate `subscription.revoked`
 * (for an old subscription) downgrade a user who has since re-subscribed. These
 * helpers let the destructive handlers reconcile against Polar's current state
 * instead of trusting the event.
 *
 * `status: "unknown"` means the lookup itself failed (network/API) — callers
 * MUST treat that as "do not perform the destructive action" and let the
 * server-side expiry reconcile cron catch genuine expirations later.
 */
export type CustomerSubscriptionState =
  | { status: "ok"; hasActiveSubscription: boolean; hasNonCancelingActive: boolean }
  | { status: "unknown" };

export async function getCustomerSubscriptionState(
  userId: string,
): Promise<CustomerSubscriptionState> {
  if (!polarClient) {
    // Polar disabled on this server — nothing to reconcile against.
    return { status: "unknown" };
  }

  try {
    const state = await polarClient.customers.getStateExternal({ externalId: userId });
    const active = state.activeSubscriptions ?? [];
    return {
      status: "ok",
      hasActiveSubscription: active.length > 0,
      hasNonCancelingActive: active.some((sub) => !sub.cancelAtPeriodEnd),
    };
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch Polar customer state for reconciliation");
    return { status: "unknown" };
  }
}
