import "server-only";

import type { WebhooksOptions } from "@polar-sh/better-auth";
import { after } from "next/server";
import { analytics } from "@/lib/analytics/server";
import {
  clearSubscriptionEndsAt,
  setSubscriptionEndsAt,
  updateUserTier,
} from "@/lib/db/repos/user-subscription";
import { createLogger } from "@/lib/logger/server";
import { handleDowngrade } from "@/lib/polar/downgrade";
import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "@/lib/polar/emails";
import { getTierForProductId } from "@/lib/polar/products";

const logger = createLogger({ source: "polar-webhooks" });

// Extract payload types from WebhooksOptions to ensure compatibility with better-auth.
// Note: We use better-auth's webhooks() plugin which handles validation internally
// (using @polar-sh/sdk/webhooks under the hood), so we don't call validateEvent directly.
// These types are inferred from the callback signatures to match what better-auth passes to us.
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

/**
 * Handle Polar subscription created webhook.
 * Called when a user initiates a subscription.
 *
 * Note: When this event occurs, the subscription status might not be "active" yet,
 * as we may still be waiting for the first payment to be processed.
 * We use subscription.active for the actual tier upgrade.
 */
export async function handleSubscriptionCreated(
  payload: SubscriptionCreatedPayload,
) {
  const { customer, product } = payload.data;

  // Log for observability, but don't upgrade tier yet
  logger.info("subscription created (pending payment)", {
    polarCustomerId: customer.id,
    userId: customer.externalId,
    productId: product.id,
    subscriptionId: payload.data.id,
    status: payload.data.status,
  });

  const tier = getTierForProductId(product.id);
  if (customer.externalId) {
    analytics.track(
      "subscription_created",
      { productId: product.id, tier: tier ?? "unknown" },
      customer.externalId,
    );
  }
}

/**
 * Handle Polar subscription active webhook.
 * Called when a subscription becomes active (payment confirmed).
 *
 * This is when we actually upgrade the user's tier and clear any pending cancellation.
 */
export async function handleSubscriptionActive(
  payload: SubscriptionActivePayload,
) {
  const { customer, product } = payload.data;
  const userId = customer.externalId;

  logger.info("subscription active (payment confirmed)", {
    polarCustomerId: customer.id,
    userId,
    productId: product.id,
    subscriptionId: payload.data.id,
  });

  if (!userId) {
    logger.error("subscription webhook missing customer.externalId (userId)", {
      polarCustomerId: customer.id,
    });
    return;
  }

  // Determine tier from product ID
  const tier = getTierForProductId(product.id);
  if (!tier) {
    logger.error("unknown product ID in subscription webhook", {
      productId: product.id,
      productName: product.name,
      userId,
    });
    return;
  }

  try {
    // Upgrade tier and clear any pending cancellation (e.g., user re-subscribed)
    await updateUserTier(userId, tier);
    await clearSubscriptionEndsAt(userId);
    logger.info("upgraded user tier", { userId, tier });

    analytics.track("subscription_activated", { tier }, userId);

    // Send welcome email (best-effort, don't fail webhook on email error)
    after(() => sendProUpgradeEmail(userId));
  } catch (err) {
    logger.error("failed to upgrade user tier", err, { userId, tier });
    throw err; // Re-throw to trigger webhook retry
  }
}

/**
 * Handle Polar subscription canceled webhook.
 * Called when a user cancels their subscription (but still has access until period ends).
 *
 * This is different from "revoked" - the user keeps their Pro access until currentPeriodEnd.
 * We store the end date to show a "Subscription ending" banner in the dashboard.
 */
export async function handleSubscriptionCanceled(
  payload: SubscriptionCanceledPayload,
) {
  const { customer, currentPeriodEnd, canceledAt } = payload.data;
  const userId = customer.externalId;

  logger.info("subscription canceled (still active until period end)", {
    polarCustomerId: customer.id,
    userId,
    subscriptionId: payload.data.id,
    currentPeriodEnd,
    canceledAt,
  });

  if (!userId) {
    logger.error("subscription webhook missing customer.externalId (userId)", {
      polarCustomerId: customer.id,
    });
    return;
  }

  // Store the end date so we can show a banner in the dashboard
  // Additional reminder emails are sent via the check-subscription-expiry cron job
  if (currentPeriodEnd) {
    const endsAt = new Date(currentPeriodEnd);
    try {
      await setSubscriptionEndsAt(userId, endsAt);

      analytics.track(
        "subscription_canceled",
        { endsAt: endsAt.toISOString() },
        userId,
      );

      // Send immediate cancellation confirmation email (best-effort, don't fail webhook on email error)
      after(() => sendSubscriptionCancelingEmail(userId, endsAt));
    } catch (err) {
      logger.error("failed to set subscription end date", err, { userId });
      throw err; // Re-throw to trigger webhook retry
    }
  }
}

/**
 * Handle Polar subscription revoked webhook.
 * Called when access actually ends - the user loses access immediately.
 *
 * This happens when:
 * - The billing period ends after cancellation
 * - Immediately if canceled with cancel_at_period_end: false
 * - Payment is past due after retries exhausted
 *
 * This is when we actually downgrade the user's tier and clear the subscription end date.
 */
export async function handleSubscriptionRevoked(
  payload: SubscriptionRevokedPayload,
) {
  const { customer } = payload.data;
  const userId = customer.externalId;

  logger.info("subscription revoked (access ended)", {
    polarCustomerId: customer.id,
    userId,
    subscriptionId: payload.data.id,
  });

  if (!userId) {
    logger.error("subscription webhook missing customer.externalId (userId)", {
      polarCustomerId: customer.id,
    });
    return;
  }

  try {
    const archivedCount = await handleDowngrade(userId);
    await clearSubscriptionEndsAt(userId);
    logger.info("downgraded user", { userId, archivedCount });

    analytics.track("subscription_revoked", { archivedCount }, userId);

    // Send expiration email (best-effort, don't fail webhook on email error)
    after(() => sendSubscriptionExpiredEmail(userId, archivedCount));
  } catch (err) {
    logger.error("failed to downgrade user", err, { userId });
    throw err; // Re-throw to trigger webhook retry
  }
}
