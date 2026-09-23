import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";

import {
  clearSubscriptionEndsAt,
  getUserSubscription,
  setSubscriptionEndsAt,
  updateUserTier,
} from "@domainstack/db/queries/user-subscription";
import { createLogger } from "@domainstack/logger";
import type { BillingDetails, Plan } from "@domainstack/types";

import { sendProUpgradeEmail, sendSubscriptionCancelingEmail } from "./emails";
import { polarClient } from "./server";

const logger = createLogger({ source: "polar/reconcile" });

/**
 * Live Polar state, since webhooks can arrive duplicated or out of order.
 * On `"unknown"` (lookup failed), skip destructive actions; the cron catches up.
 */
export type CustomerSubscriptionState =
  | { status: "ok"; hasActiveSubscription: boolean; hasNonCancelingActive: boolean }
  | { status: "unknown" };

/** The customer's active Polar subscriptions, or null when Polar is disabled or unreachable. */
async function fetchActiveSubscriptions(userId: string) {
  if (!polarClient) {
    // Polar disabled on this server — nothing to reconcile against.
    return null;
  }

  try {
    const state = await polarClient.customers.getStateExternal({ externalId: userId });
    return state.activeSubscriptions ?? [];
  } catch (err) {
    // never checked out, so Polar has no customer for this user
    if (err instanceof ResourceNotFound) return [];
    logger.error({ err, userId }, "Failed to fetch Polar customer state for reconciliation");
    return null;
  }
}

export async function getCustomerSubscriptionState(
  userId: string,
): Promise<CustomerSubscriptionState> {
  const active = await fetchActiveSubscriptions(userId);
  if (!active) return { status: "unknown" };

  return {
    status: "ok",
    hasActiveSubscription: active.length > 0,
    hasNonCancelingActive: active.some((sub) => !sub.cancelAtPeriodEnd),
  };
}

export interface SubscriptionSyncResult {
  /** Local plan after syncing. */
  plan: Plan;
  /** True when this call changed the local subscription row. */
  changed: boolean;
  /** Null when Polar is disabled or there's no active subscription. */
  billing: BillingDetails | null;
}

/**
 * Pull live Polar state into the local row, covering delayed or dropped
 * webhooks. Never downgrades — that's left to `revoked` and the cron.
 * Throws when Polar is configured but unreachable, so callers can show a retry.
 */
export async function syncSubscriptionFromPolar(userId: string): Promise<SubscriptionSyncResult> {
  const local = await getUserSubscription(userId);
  const active = await fetchActiveSubscriptions(userId);

  if (!active && polarClient) throw new Error("Polar customer state unavailable");
  if (!active?.length) return { plan: local.plan, changed: false, billing: null };

  const renewing = active.find((sub) => !sub.cancelAtPeriodEnd);
  // Every active subscription is canceling otherwise; access runs to the latest period end.
  const current =
    renewing ??
    active.reduce((latest, sub) =>
      (sub.currentPeriodEnd?.getTime() ?? 0) > (latest.currentPeriodEnd?.getTime() ?? 0)
        ? sub
        : latest,
    );
  const billing: BillingDetails = {
    amount: current.amount,
    currency: current.currency,
    interval: current.recurringInterval,
    currentPeriodEnd: current.currentPeriodEnd,
    cancelAtPeriodEnd: current.cancelAtPeriodEnd,
  };

  let changed = false;

  if (local.plan !== "pro") {
    await updateUserTier(userId, "pro");
    changed = true;
    logger.info({ userId }, "Granted pro from Polar state ahead of webhook");
    // the late `active` webhook sees wasPro and skips its email
    try {
      await sendProUpgradeEmail(userId);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send pro upgrade email");
    }
  }

  if (renewing) {
    if (local.endsAt) {
      await clearSubscriptionEndsAt(userId, local.endsAt);
      changed = true;
      logger.info({ userId }, "Cleared stale subscription end date from Polar state");
    }
  } else if (current.currentPeriodEnd) {
    const endsAt = current.currentPeriodEnd;
    if (local.endsAt?.getTime() !== endsAt.getTime()) {
      await setSubscriptionEndsAt(userId, endsAt, { resetNotificationTracking: true });
      changed = true;
      logger.info({ userId, endsAt }, "Recorded pending cancellation from Polar state");
      // the late `canceled` webhook sees endsAt unchanged and skips its email
      try {
        await sendSubscriptionCancelingEmail(userId, endsAt);
      } catch (err) {
        logger.error({ err, userId }, "Failed to send canceling email");
      }
    }
  }

  return { plan: "pro", changed, billing };
}
