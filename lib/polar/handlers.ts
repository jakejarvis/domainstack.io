import "server-only";

import { updateUserTier } from "@/lib/db/repos/user-limits";
import { createLogger } from "@/lib/logger/server";
import { handleDowngrade } from "@/lib/polar/downgrade";
import { getTierForProductId } from "@/lib/polar/products";

const logger = createLogger({ source: "polar-webhooks" });

/**
 * Subscription webhook payload from Polar.
 * The customer.externalId contains our user ID (set by better-auth when createCustomerOnSignUp: true).
 */
type SubscriptionWebhookPayload = {
  data: {
    id: string;
    customerId: string; // Polar's internal customer ID
    customer: {
      id: string;
      externalId: string | null; // Our user ID
      email: string;
      name: string | null;
    };
    product: {
      id: string;
      name: string;
    };
    status: string;
    metadata?: Record<string, unknown>;
  };
};

/**
 * Handle Polar subscription created webhook.
 * Called when a user successfully subscribes to a plan.
 */
export async function handleSubscriptionCreated(
  payload: SubscriptionWebhookPayload,
) {
  const { customer, product } = payload.data;
  const userId = customer.externalId;

  logger.info("subscription created", {
    polarCustomerId: customer.id,
    userId,
    productId: product.id,
    subscriptionId: payload.data.id,
  });

  if (!userId) {
    logger.error("subscription webhook missing customer.externalId (userId)", {
      polarCustomerId: customer.id,
      customerEmail: customer.email,
    });
    return;
  }

  // Determine tier from product ID
  const tier = getTierForProductId(product.id);
  if (!tier) {
    logger.warn("unknown product ID in subscription", {
      productId: product.id,
      productName: product.name,
      userId,
    });
    return;
  }

  try {
    await updateUserTier(userId, tier);
    logger.info("upgraded user tier", { userId, tier });
  } catch (err) {
    logger.error("failed to upgrade user tier", err, { userId, tier });
    throw err; // Re-throw to trigger webhook retry
  }
}

/**
 * Handle Polar subscription revoked webhook.
 * Called when a subscription is cancelled or expires.
 */
export async function handleSubscriptionRevoked(
  payload: SubscriptionWebhookPayload,
) {
  const { customer } = payload.data;
  const userId = customer.externalId;

  logger.info("subscription revoked", {
    polarCustomerId: customer.id,
    userId,
    subscriptionId: payload.data.id,
  });

  if (!userId) {
    logger.error("subscription webhook missing customer.externalId (userId)", {
      polarCustomerId: customer.id,
      customerEmail: customer.email,
    });
    return;
  }

  try {
    await handleDowngrade(userId);
    logger.info("downgraded user", { userId });
  } catch (err) {
    logger.error("failed to downgrade user", err, { userId });
    throw err; // Re-throw to trigger webhook retry
  }
}
