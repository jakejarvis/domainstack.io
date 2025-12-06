import "server-only";

import { render } from "@react-email/components";
import { differenceInDays, format } from "date-fns";
import type React from "react";
import SubscriptionCancelingEmail from "@/emails/subscription-canceling";
import { BASE_URL } from "@/lib/constants";
import {
  getUsersWithEndingSubscriptions,
  setLastExpiryNotification,
} from "@/lib/db/repos/user-subscription";
import { inngest } from "@/lib/inngest/client";
import { createLogger } from "@/lib/logger/server";
import { RESEND_FROM_EMAIL, resend } from "@/lib/resend";

const logger = createLogger({ source: "check-subscription-expiry" });

/**
 * Safely extract first name from a name string.
 * Handles null, undefined, empty, or whitespace-only names.
 */
function getFirstName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

// Thresholds for subscription expiry reminders (days before expiration)
const SUBSCRIPTION_EXPIRY_THRESHOLDS = [7, 3, 1] as const;
type SubscriptionExpiryThreshold =
  (typeof SUBSCRIPTION_EXPIRY_THRESHOLDS)[number];

// Pre-sorted ascending for threshold lookup (most urgent first)
const SORTED_THRESHOLDS = [...SUBSCRIPTION_EXPIRY_THRESHOLDS].sort(
  (a, b) => a - b,
);

/**
 * Get the subscription expiry notification threshold for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 */
function getSubscriptionExpiryThreshold(
  daysRemaining: number,
): SubscriptionExpiryThreshold | null {
  for (const threshold of SORTED_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return threshold as SubscriptionExpiryThreshold;
    }
  }
  return null;
}

/**
 * Generate idempotency key for subscription expiry email.
 * Format: subscription_expiry:{userId}:{threshold}d:{endsAtDate}
 *
 * Includes the endsAt date to handle the case where a user:
 * 1. Cancels subscription → gets 7-day notification
 * 2. Resubscribes (clears lastExpiryNotification)
 * 3. Cancels again with a new endsAt date
 *
 * Without the date, if steps 2-3 happen within Resend's idempotency window
 * (~24-48 hours), the new notification would be suppressed.
 */
function generateSubscriptionIdempotencyKey(
  userId: string,
  threshold: SubscriptionExpiryThreshold,
  endsAt: Date,
): string {
  const dateStr = endsAt.toISOString().split("T")[0];
  return `subscription_expiry:${userId}:${threshold}d:${dateStr}`;
}

/**
 * Check if we should send a notification for the given threshold.
 * Only sends if it's more urgent (smaller) than what we've already sent.
 *
 * @param currentThreshold - The threshold we want to send (7, 3, or 1)
 * @param lastSent - The last threshold sent (null if none)
 * @returns true if we should send
 */
function shouldSendNotification(
  currentThreshold: SubscriptionExpiryThreshold,
  lastSent: number | null,
): boolean {
  // Never sent before - send it
  if (lastSent === null) {
    return true;
  }
  // Only send if current threshold is more urgent (smaller) than last sent
  return currentThreshold < lastSent;
}

/**
 * Cron job to check for ending Pro subscriptions and send reminder emails.
 * Runs daily at 9:30 AM UTC (after domain/certificate expiry checks).
 *
 * Sends reminders at 7, 3, and 1 day before subscription ends.
 * Tracks which notifications have been sent in the database to prevent duplicates.
 * Uses Resend idempotency keys as an additional safety layer.
 */
export const checkSubscriptionExpiry = inngest.createFunction(
  {
    id: "check-subscription-expiry",
    retries: 3,
    concurrency: {
      limit: 1,
    },
  },
  // Run every day at 9:30 AM UTC
  { cron: "30 9 * * *" },
  async ({ step, logger: inngestLogger }) => {
    inngestLogger.info("Starting subscription expiry check");

    // Get all users with ending subscriptions (endsAt set and in the future)
    const usersWithEndingSubscriptions = await step.run(
      "fetch-ending-subscriptions",
      async () => {
        return await getUsersWithEndingSubscriptions();
      },
    );

    inngestLogger.info(
      `Found ${usersWithEndingSubscriptions.length} users with ending subscriptions`,
    );

    const results = {
      total: usersWithEndingSubscriptions.length,
      notificationsSent: 0,
      skipped: 0,
      errors: 0,
    };

    // Max threshold is 7 days - if subscription ends later, skip
    const MAX_THRESHOLD_DAYS = 7;

    for (const user of usersWithEndingSubscriptions) {
      const daysRemaining = differenceInDays(user.endsAt, new Date());

      // Skip if beyond max threshold
      if (daysRemaining > MAX_THRESHOLD_DAYS) {
        results.skipped++;
        continue;
      }

      // Skip if already expired (should have been handled by revoked webhook)
      if (daysRemaining < 0) {
        results.skipped++;
        continue;
      }

      const threshold = getSubscriptionExpiryThreshold(daysRemaining);
      if (!threshold) {
        results.skipped++;
        continue;
      }

      // Check if we've already sent this threshold (or a more urgent one)
      if (!shouldSendNotification(threshold, user.lastExpiryNotification)) {
        results.skipped++;
        continue;
      }

      // Send notification email and update tracking
      const sent = await step.run(`send-email-${user.userId}`, async () => {
        const success = await sendSubscriptionExpiryNotification({
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          endsAt: new Date(user.endsAt),
          daysRemaining,
          threshold,
        });

        // Update tracking if email sent successfully
        if (success) {
          await setLastExpiryNotification(user.userId, threshold);
        }

        return success;
      });

      if (sent) {
        results.notificationsSent++;
      } else {
        results.errors++;
      }
    }

    inngestLogger.info("Subscription expiry check complete", results);
    return results;
  },
);

async function sendSubscriptionExpiryNotification({
  userId,
  userName,
  userEmail,
  endsAt,
  daysRemaining,
  threshold,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  daysRemaining: number;
  threshold: SubscriptionExpiryThreshold;
}): Promise<boolean> {
  if (!resend) {
    logger.warn("Resend not configured, skipping email", { userId });
    return false;
  }

  const idempotencyKey = generateSubscriptionIdempotencyKey(
    userId,
    threshold,
    endsAt,
  );

  try {
    const dashboardUrl = `${BASE_URL}/dashboard`;
    const firstName = getFirstName(userName);
    const endDate = format(endsAt, "MMMM d, yyyy");

    const emailHtml = await render(
      SubscriptionCancelingEmail({
        userName: firstName,
        endDate,
        dashboardUrl,
      }) as React.ReactElement,
    );

    // Determine urgency for subject line
    const isUrgent = daysRemaining <= 3;
    const subject = isUrgent
      ? `⚠️ Your Pro subscription ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
      : `Your Pro subscription ends on ${endDate}`;

    const { data, error } = await resend.emails.send(
      {
        from: `Domainstack <${RESEND_FROM_EMAIL}>`,
        to: userEmail,
        subject,
        html: emailHtml,
      },
      {
        idempotencyKey,
      },
    );

    if (error) {
      logger.error("Failed to send subscription expiry email", error, {
        userId,
        userEmail,
        idempotencyKey,
      });
      // Don't throw - we don't want to retry and potentially spam users
      return false;
    }

    logger.info("Sent subscription expiry notification", {
      userId,
      userEmail,
      emailId: data?.id,
      daysRemaining,
      threshold,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription expiry notification", err, {
      userId,
      userEmail,
      idempotencyKey,
    });
    return false;
  }
}
