import "server-only";

import { format } from "date-fns";
import ProUpgradeSuccessEmail from "@/emails/pro-upgrade-success";
import ProWelcomeEmail from "@/emails/pro-welcome";
import SubscriptionCancelingEmail from "@/emails/subscription-canceling";
import SubscriptionExpiredEmail from "@/emails/subscription-expired";
import { getUserById } from "@/lib/db/repos/users";
import { createLogger } from "@/lib/logger/server";
import { sendEmail } from "@/lib/resend";

const logger = createLogger({ source: "polar-emails" });

/**
 * Safely extract first name from a name string.
 * Handles null, undefined, empty, or whitespace-only names.
 */
function getFirstName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
}

/**
 * Get today's date as YYYY-MM-DD string for idempotency keys.
 */
function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Generate idempotency key for Pro upgrade email.
 * Format: pro_upgrade_success:{userId}:{date}
 *
 * Uses today's date to ensure:
 * - Webhook retries within Resend's idempotency window (~24-48h) don't duplicate
 * - Re-subscribing on a different day sends a fresh welcome email
 */
function generateUpgradeIdempotencyKey(userId: string): string {
  return `pro_upgrade_success:${userId}:${getTodayDateString()}`;
}

/**
 * Generate idempotency key for Pro welcome/tips email.
 * Format: pro_welcome:{userId}:{date}
 */
function generateWelcomeIdempotencyKey(userId: string): string {
  return `pro_welcome:${userId}:${getTodayDateString()}`;
}

/**
 * Send Pro upgrade success email.
 * Called when a subscription becomes active (payment confirmed).
 *
 * Uses idempotency key to prevent duplicate emails on webhook retries.
 */
export async function sendProUpgradeEmail(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) {
    logger.error({ userId }, "user not found for upgrade email");
    return false;
  }

  const idempotencyKey = generateUpgradeIdempotencyKey(userId);

  try {
    const firstName = getFirstName(user.name);

    const { error } = await sendEmail(
      {
        to: user.email,
        subject: "🎉 Welcome to Domainstack Pro!",
        react: ProUpgradeSuccessEmail({
          userName: firstName,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error({ err: error, userId, idempotencyKey });
      return false;
    }

    // Also send the welcome/tips email (best-effort, non-critical)
    try {
      await sendProWelcomeEmail(userId, user.name, user.email);
    } catch (err) {
      logger.error({ err, userId });
    }

    return true;
  } catch (err) {
    logger.error({ err, userId, idempotencyKey });
    return false;
  }
}

/**
 * Send Pro welcome/tips email (sent after upgrade success).
 *
 * Uses idempotency key to prevent duplicate emails on webhook retries.
 */
async function sendProWelcomeEmail(
  userId: string,
  userName: string,
  userEmail: string,
): Promise<boolean> {
  const idempotencyKey = generateWelcomeIdempotencyKey(userId);

  try {
    const firstName = getFirstName(userName);

    const { error } = await sendEmail(
      {
        to: userEmail,
        subject: "Getting the most out of Domainstack Pro",
        react: ProWelcomeEmail({
          userName: firstName,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error({ err: error, userId, idempotencyKey });
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, userId, idempotencyKey });
    return false;
  }
}

/**
 * Generate idempotency key for immediate subscription cancellation email.
 * Format: subscription_cancel_immediate:{userId}:{endsAtDate}
 *
 * Uses the date portion of endsAt to allow re-sending if user cancels again
 * with a different end date (e.g., cancels, resubscribes, cancels again).
 */
function generateCancellationIdempotencyKey(
  userId: string,
  endsAt: Date,
): string {
  // biome-ignore lint/nursery/useDestructuring: this is a constant
  const dateStr = endsAt.toISOString().split("T")[0];
  return `subscription_cancel_immediate:${userId}:${dateStr}`;
}

/**
 * Send subscription canceling email.
 * Called when user cancels but still has access until period ends.
 *
 * Uses idempotency key to prevent duplicate emails on webhook retries.
 */
export async function sendSubscriptionCancelingEmail(
  userId: string,
  endsAt: Date,
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) {
    logger.error({ userId }, "user not found for canceling email");
    return false;
  }

  const idempotencyKey = generateCancellationIdempotencyKey(userId, endsAt);

  try {
    const firstName = getFirstName(user.name);
    const endDate = format(endsAt, "MMMM d, yyyy");

    const { error } = await sendEmail(
      {
        to: user.email,
        subject: `Your Pro subscription ends on ${endDate}`,
        react: SubscriptionCancelingEmail({
          userName: firstName,
          endDate,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error({ err: error, userId, idempotencyKey });
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, userId, idempotencyKey });
    return false;
  }
}

/**
 * Generate idempotency key for subscription expired email.
 * Format: subscription_expired:{userId}:{date}
 *
 * Uses today's date to ensure:
 * - Webhook retries within Resend's idempotency window (~24-48h) don't duplicate
 * - If subscription expires again on a different day, a fresh email is sent
 */
function generateExpiredIdempotencyKey(userId: string): string {
  return `subscription_expired:${userId}:${getTodayDateString()}`;
}

/**
 * Send subscription expired email.
 * Called when subscription is revoked (access ended).
 *
 * Uses idempotency key to prevent duplicate emails on webhook retries.
 */
export async function sendSubscriptionExpiredEmail(
  userId: string,
  archivedCount: number,
): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) {
    logger.error({ userId }, "user not found for expired email");
    return false;
  }

  const idempotencyKey = generateExpiredIdempotencyKey(userId);

  try {
    const firstName = getFirstName(user.name);

    const { error } = await sendEmail(
      {
        to: user.email,
        subject: "Your Pro subscription has ended",
        react: SubscriptionExpiredEmail({
          userName: firstName,
          archivedCount,
        }),
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error({ err: error, userId, idempotencyKey });
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err, userId, idempotencyKey });
    return false;
  }
}
