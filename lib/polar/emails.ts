import "server-only";

import { render } from "@react-email/components";
import { format } from "date-fns";
import type React from "react";
import ProUpgradeSuccessEmail from "@/emails/pro-upgrade-success";
import ProWelcomeEmail from "@/emails/pro-welcome";
import SubscriptionCancelingEmail from "@/emails/subscription-canceling";
import SubscriptionExpiredEmail from "@/emails/subscription-expired";
import { BASE_URL } from "@/lib/constants";
import { getUserById } from "@/lib/db/repos/users";
import { getTierLimits } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

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
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for upgrade email", { userId });
    return false;
  }

  const idempotencyKey = generateUpgradeIdempotencyKey(userId);

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = getFirstName(user.name);
    const tierLimits = await getTierLimits();

    const emailHtml = await render(
      ProUpgradeSuccessEmail({
        userName: firstName,
        dashboardUrl,
        proMaxDomains: tierLimits.pro,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: user.email,
        subject: "🎉 Welcome to Domainstack Pro!",
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send Pro upgrade email", error, {
        userId,
        idempotencyKey,
      });
      return false;
    }

    logger.info("Sent Pro upgrade email", {
      userId,
      emailId: data?.id,
      idempotencyKey,
    });

    // Also send the welcome/tips email (best-effort, non-critical)
    try {
      await sendProWelcomeEmail(userId, user.name, user.email, tierLimits.pro);
    } catch (err) {
      logger.error("Failed to send Pro welcome email (non-critical)", err, {
        userId,
      });
    }

    return true;
  } catch (err) {
    logger.error("Error sending Pro upgrade email", err, {
      userId,
      idempotencyKey,
    });
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
  proMaxDomains: number,
): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const idempotencyKey = generateWelcomeIdempotencyKey(userId);

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = getFirstName(userName);

    const emailHtml = await render(
      ProWelcomeEmail({
        userName: firstName,
        dashboardUrl,
        proMaxDomains,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: userEmail,
        subject: "Getting the most out of Domainstack Pro",
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send Pro welcome email", error, {
        userId,
        idempotencyKey,
      });
      return false;
    }

    logger.info("Sent Pro welcome email", {
      userId,
      emailId: data?.id,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending Pro welcome email", err, {
      userId,
      idempotencyKey,
    });
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
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for canceling email", { userId });
    return false;
  }

  const idempotencyKey = generateCancellationIdempotencyKey(userId, endsAt);

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = getFirstName(user.name);
    const endDate = format(endsAt, "MMMM d, yyyy");

    const emailHtml = await render(
      SubscriptionCancelingEmail({
        userName: firstName,
        endDate,
        dashboardUrl,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: user.email,
        subject: `Your Pro subscription ends on ${endDate}`,
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send subscription canceling email", error, {
        userId,
        idempotencyKey,
      });
      return false;
    }

    logger.info("Sent subscription canceling email", {
      userId,
      emailId: data?.id,
      endsAt: endsAt.toISOString(),
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription canceling email", err, {
      userId,
      idempotencyKey,
    });
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
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const user = await getUserById(userId);
  if (!user) {
    logger.error("User not found for expired email", { userId });
    return false;
  }

  const idempotencyKey = generateExpiredIdempotencyKey(userId);

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = getFirstName(user.name);
    const tierLimits = await getTierLimits();

    const emailHtml = await render(
      SubscriptionExpiredEmail({
        userName: firstName,
        archivedCount,
        dashboardUrl,
        freeMaxDomains: tierLimits.free,
        proMaxDomains: tierLimits.pro,
      }) as React.ReactElement,
    );

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: user.email,
        subject: "Your Pro subscription has ended",
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send subscription expired email", error, {
        userId,
        idempotencyKey,
      });
      return false;
    }

    logger.info("Sent subscription expired email", {
      userId,
      emailId: data?.id,
      archivedCount,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription expired email", err, {
      userId,
      idempotencyKey,
    });
    return false;
  }
}
