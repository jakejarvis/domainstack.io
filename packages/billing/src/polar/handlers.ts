import type { WebhooksOptions } from "@polar-sh/better-auth";

import { recomputeEntitlement, upsertBillingSubscription } from "@domainstack/db/queries";
import { logger } from "@domainstack/logger";

import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "../emails";
import { getTierForProductId } from "./products";
import { polarProvider } from "./provider";
import { getCustomerSubscriptionState } from "./reconcile";

// Extract payload types from WebhooksOptions
type SubscriptionCreatedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCreated"]>
>[0];
type SubscriptionActivePayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionActive"]>
>[0];
type SubscriptionCanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCanceled"]>
>[0];
type SubscriptionRevokedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionRevoked"]>
>[0];
type SubscriptionUncanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionUncanceled"]>
>[0];

/**
 * Handle subscription.created webhook.
 * Payment is not yet confirmed — log only; the entitlement is granted on
 * subscription.active.
 */
export async function handleSubscriptionCreated(
  payload: SubscriptionCreatedPayload,
): Promise<void> {
  const { data } = payload;
  logger.info(
    {
      subscriptionId: data.id,
      userId: data.customer.externalId,
      productId: data.product.id,
      tier: getTierForProductId(data.product.id),
      status: data.status,
    },
    "Subscription created (awaiting payment confirmation)",
  );
}

/**
 * Handle subscription.active webhook.
 * Payment confirmed: upsert the Polar billing row, recompute the entitlement,
 * and send the welcome email.
 */
export async function handleSubscriptionActive(payload: SubscriptionActivePayload): Promise<void> {
  const { data } = payload;
  const { userId, upsert } = await polarProvider.normalizeEvent(payload);
  // Single paid tier: any active subscription means "pro". We log the
  // product→tier mapping for observability but no longer gate the upgrade on
  // it — a sandbox/prod product-id mismatch must not silently leave a paying
  // customer un-upgraded.
  const mappedTier = getTierForProductId(data.product.id);

  logger.info(
    { subscriptionId: data.id, userId, productId: data.product.id, mappedTier },
    "Subscription active",
  );

  if (!userId || !upsert) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping tier upgrade");
    return;
  }

  if (!mappedTier) {
    logger.warn(
      { subscriptionId: data.id, productId: data.product.id },
      "Active subscription product is not in POLAR_PRODUCTS; upgrading to pro anyway (single-tier model)",
    );
  }

  await upsertBillingSubscription(userId, upsert);
  const result = await recomputeEntitlement(userId);

  // Polar delivers webhooks at-least-once. Only send the welcome email on a
  // real free→pro transition: a redelivered `subscription.active` recomputes
  // to the same pro state (`upgraded === false`) and must not re-send it.
  if (result.upgraded) {
    // Send welcome email (don't fail webhook if email fails)
    try {
      await sendProUpgradeEmail(userId);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send pro upgrade email");
    }
  }
}

/**
 * Handle subscription.canceled webhook.
 * The subscription remains active until currentPeriodEnd.
 */
export async function handleSubscriptionCanceled(
  payload: SubscriptionCanceledPayload,
): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;

  logger.info(
    {
      subscriptionId: data.id,
      userId,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: data.currentPeriodEnd,
    },
    "Subscription canceled",
  );

  if (!userId) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping end date update");
    return;
  }

  if (!data.currentPeriodEnd) {
    logger.warn({ subscriptionId: data.id }, "No currentPeriodEnd, skipping end date update");
    return;
  }

  // Reconcile against Polar: an out-of-order `canceled` (for an old
  // subscription) arriving after the customer re-subscribed must not set a
  // bogus end date that triggers expiry emails / downgrade.
  const state = await getCustomerSubscriptionState(userId);
  if (state.status === "ok" && state.hasNonCancelingActive) {
    logger.info(
      { subscriptionId: data.id, userId },
      "Customer has a non-canceling active subscription; ignoring stale canceled event",
    );
    return;
  }

  const { upsert } = await polarProvider.normalizeEvent(payload);
  if (!upsert) {
    return;
  }

  await upsertBillingSubscription(userId, upsert);
  const result = await recomputeEntitlement(userId);

  // Only email when this established a new cancellation cycle. A redelivered
  // `canceled` event recomputes to the same endsAt (`changed === false`) and
  // must not re-send the "subscription ending" email.
  if (result.changed) {
    // Send cancellation confirmation email (don't fail webhook if email fails)
    try {
      await sendSubscriptionCancelingEmail(userId, data.currentPeriodEnd);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send canceling email");
    }
  }
}

/**
 * Handle subscription.revoked webhook.
 * The subscription has ended (naturally or due to non-payment).
 */
export async function handleSubscriptionRevoked(
  payload: SubscriptionRevokedPayload,
): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;

  logger.info({ subscriptionId: data.id, userId }, "Subscription revoked");

  if (!userId) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping downgrade");
    return;
  }

  // Reconcile against Polar before the destructive downgrade+archive. A
  // duplicate/out-of-order `revoked` (for an old subscription) must not
  // downgrade and archive the domains of a user who has re-subscribed. If the
  // live lookup fails ("unknown"), skip too — the check-subscription-expiry
  // reconcile cron will downgrade genuinely-expired users safely.
  const state = await getCustomerSubscriptionState(userId);
  if (state.status !== "ok") {
    logger.warn(
      { subscriptionId: data.id, userId },
      "Could not verify Polar customer state; skipping downgrade (cron will reconcile)",
    );
    return;
  }
  if (state.hasActiveSubscription) {
    logger.info(
      { subscriptionId: data.id, userId },
      "Customer still has an active subscription; ignoring stale revoked event",
    );
    return;
  }

  const { upsert } = await polarProvider.normalizeEvent(payload);
  if (!upsert) {
    return;
  }

  await upsertBillingSubscription(userId, upsert);
  const result = await recomputeEntitlement(userId);

  // Only email if this revoke actually downgraded the user. A multi-provider
  // user still active elsewhere stays pro — don't tell them Pro ended. For
  // Polar-only users this is always true here, so behavior is unchanged.
  if (result.downgraded) {
    try {
      await sendSubscriptionExpiredEmail(userId, result.archivedCount);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send expired email");
    }
  }
}

/**
 * Handle subscription.uncanceled webhook.
 * The user re-activated a canceled subscription before it ended.
 */
export async function handleSubscriptionUncanceled(
  payload: SubscriptionUncanceledPayload,
): Promise<void> {
  const { data } = payload;
  const { userId, upsert } = await polarProvider.normalizeEvent(payload);

  logger.info({ subscriptionId: data.id, userId }, "Subscription uncanceled");

  if (!userId || !upsert) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping end date clear");
    return;
  }

  await upsertBillingSubscription(userId, upsert);
  await recomputeEntitlement(userId);
}
