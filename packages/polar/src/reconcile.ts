import { getStateExternalCustomers } from "@polar-sh/sdk/2026-10/services/customers";

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
  | {
      status: "ok";
      hasActiveSubscription: boolean;
      hasNonCancelingActive: boolean;
      /**
       * When every active subscription is canceling, the latest `current_period_end`
       * among them (when access actually ends). `null` if any subscription is
       * renewing, there are none, or no period end could be parsed.
       */
      cancelingPeriodEnd: Date | null;
    }
  | { status: "unknown" };

/**
 * Polar answers 404 when the customer doesn't exist (never checked out, or
 * deleted). Duck-typed on `statusCode` to avoid importing an SDK internal path.
 */
function isPolarNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "statusCode" in err && err.statusCode === 404;
}

function latestPeriodEnd(subscriptions: { current_period_end: string }[]): Date | null {
  let latest: Date | null = null;
  for (const sub of subscriptions) {
    const end = new Date(sub.current_period_end);
    if (Number.isNaN(end.getTime())) continue;
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

export async function getCustomerSubscriptionState(
  userId: string,
): Promise<CustomerSubscriptionState> {
  if (!polarClient) {
    // Polar disabled on this server — nothing to reconcile against.
    return { status: "unknown" };
  }

  try {
    const state = await getStateExternalCustomers(polarClient)(userId);
    const active = state.active_subscriptions;
    const hasNonCancelingActive = active.some((sub) => !sub.cancel_at_period_end);
    return {
      status: "ok",
      hasActiveSubscription: active.length > 0,
      hasNonCancelingActive,
      cancelingPeriodEnd:
        active.length > 0 && !hasNonCancelingActive ? latestPeriodEnd(active) : null,
    };
  } catch (err) {
    // Polar answers 404 when the customer doesn't exist (never checked out, or deleted).
    // That is a definite "no subscription", not an unknown state.
    if (isPolarNotFound(err)) {
      return {
        status: "ok",
        hasActiveSubscription: false,
        hasNonCancelingActive: false,
        cancelingPeriodEnd: null,
      };
    }
    logger.error({ err, userId }, "Failed to fetch Polar customer state for reconciliation");
    return { status: "unknown" };
  }
}
