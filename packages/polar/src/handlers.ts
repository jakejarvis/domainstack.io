import type { WebhooksOptions } from "@polar-sh/better-auth";

import {
  clearSubscriptionEndsAt,
  getUserSubscription,
  setSubscriptionEndsAt,
  updateUserTier,
} from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";

import { analytics } from "./analytics";
import { handleDowngrade } from "./downgrade";
import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "./emails";
import { getProductByProductId, getTierForProductId } from "./products";
import { getCustomerSubscriptionState } from "./reconcile";

const logger = createLogger({ source: "polar/webhooks" });

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
type OrderPaidPayload = Parameters<NonNullable<WebhooksOptions["onOrderPaid"]>>[0];

/**
 * Handle subscription.created webhook.
 * This is called when a subscription is created but payment is not yet confirmed.
 * We only log here - tier upgrade happens in subscription.active.
 */
export async function handleSubscriptionCreated(
  payload: SubscriptionCreatedPayload,
): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;
  const tier = getTierForProductId(data.product.id);

  logger.info(
    {
      subscriptionId: data.id,
      userId,
      productId: data.product.id,
      tier,
      status: data.status,
    },
    "Subscription created (awaiting payment confirmation)",
  );
}

/**
 * Handle subscription.active webhook.
 * This is called when payment is confirmed and the subscription is active.
 * Upgrade the user's tier and send a welcome email.
 */
export async function handleSubscriptionActive(payload: SubscriptionActivePayload): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;
  // Single paid tier: any active subscription means "pro". We log the
  // product→tier mapping for observability but no longer gate the upgrade on
  // it — a sandbox/prod product-id mismatch must not silently leave a paying
  // customer un-upgraded.
  const mappedTier = getTierForProductId(data.product.id);

  logger.info(
    {
      subscriptionId: data.id,
      userId,
      productId: data.product.id,
      mappedTier,
    },
    "Subscription active",
  );

  if (!userId) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping tier upgrade");
    return;
  }

  if (!mappedTier) {
    logger.warn(
      { subscriptionId: data.id, productId: data.product.id },
      "Active subscription product is not in POLAR_PRODUCTS; upgrading to pro anyway (single-tier model)",
    );
  }

  const previous = await getUserSubscription(userId);
  const wasPro = previous.plan === "pro";

  // Upgrade user tier
  await updateUserTier(userId, "pro");

  // Clear any pending subscription end date (in case they re-subscribed)
  await clearSubscriptionEndsAt(userId);

  // Polar delivers webhooks at-least-once. Only send the welcome email on a
  // real free→pro transition: a redelivered `subscription.active` that finds
  // the user already on pro must not re-send it.
  if (!wasPro) {
    try {
      await sendProUpgradeEmail(userId);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send pro upgrade email");
    }
  }

  const product = getProductByProductId(data.product.id);
  analytics.track(
    "subscription_started",
    {
      subscription_id: data.id,
      product_id: data.product.id,
      product: data.product.name,
      interval: product?.interval,
      amount: data.amount,
      currency: data.currency,
      tier: mappedTier ?? "pro",
    },
    userId,
  );
}

/**
 * Handle subscription.canceled webhook.
 * This is called when the user cancels their subscription.
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

  const previous = await getUserSubscription(userId);
  const previousEndsAtMs = previous.endsAt?.getTime() ?? null;
  const nextEndsAtMs = data.currentPeriodEnd.getTime();
  const endsAtChanged = previousEndsAtMs !== nextEndsAtMs;

  // Set the subscription end date
  await setSubscriptionEndsAt(userId, data.currentPeriodEnd);

  // Only email when this established a new cancellation cycle. A redelivered
  // `canceled` event with an unchanged endsAt must not re-send the
  // "subscription ending" email.
  if (endsAtChanged) {
    try {
      await sendSubscriptionCancelingEmail(userId, data.currentPeriodEnd);
    } catch (err) {
      logger.error({ err, userId }, "Failed to send canceling email");
    }
  }
}

/**
 * Handle subscription.revoked webhook.
 * This is called when the subscription ends (either naturally or due to non-payment).
 * Downgrade the user to the free tier.
 */
export async function handleSubscriptionRevoked(
  payload: SubscriptionRevokedPayload,
): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;

  logger.info(
    {
      subscriptionId: data.id,
      userId,
    },
    "Subscription revoked",
  );

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

  // Downgrade user to free tier (may archive domains if over limit)
  const archivedCount = await handleDowngrade(userId);

  // Clear the subscription end date
  await clearSubscriptionEndsAt(userId);

  // Send expiration email (don't fail webhook if email fails)
  try {
    await sendSubscriptionExpiredEmail(userId, archivedCount);
  } catch (err) {
    logger.error({ err, userId }, "Failed to send expired email");
  }
}

/**
 * Handle subscription.uncanceled webhook.
 * This is called when the user re-activates a canceled subscription before it ends.
 */
export async function handleSubscriptionUncanceled(
  payload: SubscriptionUncanceledPayload,
): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;

  logger.info(
    {
      subscriptionId: data.id,
      userId,
    },
    "Subscription uncanceled",
  );

  if (!userId) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping end date clear");
    return;
  }

  // Clear the subscription end date since they're no longer canceling
  await clearSubscriptionEndsAt(userId);
}

/**
 * Handle order.paid webhook.
 * Fires for the first payment and every renewal. Used as the customer analytics payment event.
 */
export async function handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
  const { data } = payload;
  const userId = data.customer.externalId;

  logger.info(
    {
      orderId: data.id,
      userId,
      productId: data.productId,
      totalAmount: data.totalAmount,
      currency: data.currency,
      billingReason: data.billingReason,
    },
    "Order paid",
  );

  if (!userId) {
    logger.warn({ orderId: data.id }, "No externalId on customer, skipping payment analytics");
    return;
  }

  analytics.track(
    "payment_succeeded",
    {
      revenue: data.totalAmount,
      currency: data.currency.toUpperCase(),
      product: data.product?.name,
      product_id: data.productId,
      subscription_id: data.subscriptionId,
      order_id: data.id,
      billing_reason: data.billingReason,
    },
    userId,
  );
}
