import type { WebhooksOptions } from "@polar-sh/better-auth";

import {
  clearSubscriptionEndsAt,
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
  const tier = getTierForProductId(data.product.id);

  logger.info(
    {
      subscriptionId: data.id,
      userId,
      productId: data.product.id,
      tier,
    },
    "Subscription active",
  );

  if (!userId) {
    logger.warn({ subscriptionId: data.id }, "No externalId on customer, skipping tier upgrade");
    return;
  }

  if (!tier) {
    logger.warn({ productId: data.product.id }, "Unknown product ID, skipping tier upgrade");
    return;
  }

  // Upgrade user tier
  await updateUserTier(userId, tier);

  // Clear any pending subscription end date (in case they re-subscribed)
  await clearSubscriptionEndsAt(userId);

  // Send welcome email (don't fail webhook if email fails)
  try {
    await sendProUpgradeEmail(userId);
  } catch (err) {
    logger.error({ err, userId }, "Failed to send pro upgrade email");
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
      tier,
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

  // Set the subscription end date
  await setSubscriptionEndsAt(userId, data.currentPeriodEnd);

  // Send cancellation confirmation email (don't fail webhook if email fails)
  try {
    await sendSubscriptionCancelingEmail(userId, data.currentPeriodEnd);
  } catch (err) {
    logger.error({ err, userId }, "Failed to send canceling email");
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
