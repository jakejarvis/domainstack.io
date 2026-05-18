import {
  getUserById,
  recomputeEntitlement,
  upsertBillingSubscription,
} from "@domainstack/db/queries";
import { logger } from "@domainstack/logger";

import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "../emails";
import { revenueCatProvider } from "./provider";
import type { RevenueCatEvent } from "./types";

/** Recompute the user's entitlement and send the welcome email on upgrade. */
async function recomputeAndMaybeUpgrade(userId: string): Promise<void> {
  const result = await recomputeEntitlement(userId);
  if (result.upgraded) {
    try {
      await sendProUpgradeEmail(userId);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send pro upgrade email");
    }
  }
}

/**
 * RevenueCat fans a store transfer out across both ids: the old
 * `app_user_id`(s) lose the subscription, the new one(s) gain it. Expire the
 * from-rows we own and re-derive the to-users from RevenueCat's authoritative
 * state (the event itself carries no product/expiration for the destination).
 */
async function handleTransfer(event: RevenueCatEvent): Promise<void> {
  const from = event.transferred_from ?? [];
  const to = event.transferred_to ?? [];

  for (const userId of from) {
    // RevenueCat ids may be anonymous ($RCAnonymousID:…) or belong to another
    // app — `billing_subscriptions.user_id` is FK→users.id, so writing a
    // non-user id would throw and make RevenueCat retry the event forever.
    if (!(await getUserById(userId))) {
      logger.info(
        { userId, transferId: event.id },
        "Transfer source is not a Domainstack user; skipping",
      );
      continue;
    }
    await upsertBillingSubscription(userId, {
      provider: "revenuecat",
      externalId: userId,
      providerSubscriptionId: event.id,
      productId: null,
      status: "expired",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    const result = await recomputeEntitlement(userId);
    if (result.downgraded) {
      try {
        await sendSubscriptionExpiredEmail(userId, result.archivedCount);
      } catch (err) {
        logger.error({ err, userId }, "Failed to send expired email");
      }
    }
  }

  for (const userId of to) {
    if (!(await getUserById(userId))) {
      logger.info(
        { userId, transferId: event.id },
        "Transfer target is not a Domainstack user; skipping grant",
      );
      continue;
    }
    const state = await revenueCatProvider.reconcile(userId);
    if (state.status !== "ok" || !state.hasActiveSubscription) {
      logger.info(
        { userId, transferId: event.id },
        "Transfer target has no active RevenueCat subscription; skipping grant",
      );
      continue;
    }
    await upsertBillingSubscription(userId, {
      provider: "revenuecat",
      externalId: userId,
      providerSubscriptionId: event.id,
      productId: null,
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    await recomputeAndMaybeUpgrade(userId);
  }
}

/**
 * Single entry point for the RevenueCat webhook route. Normalizes the event,
 * applies the reconcile-before-destructive guard for EXPIRATION/CANCELLATION
 * (mirrors the Polar handlers), upserts the `revenuecat` billing row, recomputes
 * the cross-provider entitlement, and sends transition emails.
 *
 * Throws on DB failure so the route returns non-2xx and RevenueCat retries
 * (events are delivered at-least-once); email failures are swallowed.
 */
export async function handleRevenueCatEvent(event: RevenueCatEvent): Promise<void> {
  logger.info(
    {
      type: event.type,
      userId: event.app_user_id,
      productId: event.product_id,
      environment: event.environment,
      store: event.store,
    },
    "RevenueCat event received",
  );

  if (event.type === "TRANSFER") {
    await handleTransfer(event);
    return;
  }

  const { userId, upsert, sideEffect } = await revenueCatProvider.normalizeEvent(event);
  if (!userId || !upsert) {
    logger.info(
      { type: event.type, subscriptionId: event.id },
      "RevenueCat event ignored (no app_user_id or non-entitling event)",
    );
    return;
  }

  if (upsert.status === "expired") {
    // Reconcile before the destructive downgrade+archive. A stale/duplicate
    // EXPIRATION must not strip a re-subscribed user; an unverifiable lookup
    // is left for the subscription-expiry reconcile cron.
    const state = await revenueCatProvider.reconcile(userId);
    if (state.status !== "ok") {
      logger.warn(
        { userId, subscriptionId: event.id },
        "Could not verify RevenueCat state; skipping downgrade (cron will reconcile)",
      );
      return;
    }
    if (state.hasActiveSubscription) {
      logger.info(
        { userId, subscriptionId: event.id },
        "Customer still has an active RevenueCat subscription; ignoring stale expiration",
      );
      return;
    }

    await upsertBillingSubscription(userId, upsert);
    const result = await recomputeEntitlement(userId);
    if (result.downgraded) {
      try {
        await sendSubscriptionExpiredEmail(userId, result.archivedCount);
      } catch (err) {
        logger.error({ err, userId }, "Failed to send expired email");
      }
    }
    return;
  }

  if (upsert.status === "canceling") {
    if (sideEffect.kind !== "canceling") {
      // No future period end: a canceling row would immediately drop
      // entitlement with no reconcile semantics. Skip (mirrors Polar).
      logger.warn(
        { userId, subscriptionId: event.id },
        "RevenueCat cancellation without a future period end; skipping",
      );
      return;
    }

    const state = await revenueCatProvider.reconcile(userId);
    if (state.status === "ok" && state.hasNonCancelingActive) {
      logger.info(
        { userId, subscriptionId: event.id },
        "Customer has a non-canceling active subscription; ignoring stale cancellation",
      );
      return;
    }

    await upsertBillingSubscription(userId, upsert);
    const result = await recomputeEntitlement(userId);
    if (result.changed) {
      try {
        await sendSubscriptionCancelingEmail(userId, sideEffect.periodEnd);
      } catch (err) {
        logger.error({ err, userId }, "Failed to send canceling email");
      }
    }
    return;
  }

  // status === "active": additive and safe — no reconcile needed.
  await upsertBillingSubscription(userId, upsert);
  await recomputeAndMaybeUpgrade(userId);
}
