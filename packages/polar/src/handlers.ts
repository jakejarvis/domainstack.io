import {
  clearSubscriptionEndsAt,
  setSubscriptionEndsAt,
  updateUserTier,
} from "@domainstack/db/queries";
import { logger } from "@domainstack/logger";
import type { WebhooksOptions } from "@polar-sh/better-auth";
import { handleDowngrade } from "./downgrade";
import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "./emails";
import { getTierForProductId } from "./products";

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
export async function handleSubscriptionActive(
  payload: SubscriptionActivePayload,
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
    },
    "Subscription active",
  );

  if (!userId) {
    logger.warn(
      { subscriptionId: data.id },
      "No externalId on customer, skipping tier upgrade",
    );
    return;
  }

  if (!tier) {
    logger.warn(
      { productId: data.product.id },
      "Unknown product ID, skipping tier upgrade",
    );
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
    logger.warn(
      { subscriptionId: data.id },
      "No externalId on customer, skipping end date update",
    );
    return;
  }

  if (!data.currentPeriodEnd) {
    logger.warn(
      { subscriptionId: data.id },
      "No currentPeriodEnd, skipping end date update",
    );
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
    logger.warn(
      { subscriptionId: data.id },
      "No externalId on customer, skipping downgrade",
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
    logger.warn(
      { subscriptionId: data.id },
      "No externalId on customer, skipping end date clear",
    );
    return;
  }

  // Clear the subscription end date since they're no longer canceling
  await clearSubscriptionEndsAt(userId);
}
