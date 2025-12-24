import "server-only";

import { differenceInDays, format } from "date-fns";
import type { Logger } from "inngest";
import SubscriptionCancelingEmail from "@/emails/subscription-canceling";
import {
  getUserWithEndingSubscription,
  setLastExpiryNotification,
} from "@/lib/db/repos/user-subscription";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { sendPrettyEmail } from "@/lib/resend";

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
 * Worker to check a single user's subscription expiry.
 * Triggered by the scheduler.
 */
export const checkSubscriptionExpiryWorker = inngest.createFunction(
  {
    id: "check-subscription-expiry-worker",
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: INNGEST_EVENTS.CHECK_SUBSCRIPTION_EXPIRY },
  async ({ event, step, logger: inngestLogger }) => {
    const { userId } = event.data;

    const user = await step.run("fetch-user", async () => {
      return await getUserWithEndingSubscription(userId);
    });

    if (!user) {
      inngestLogger.warn("User not found or subscription not ending", {
        userId,
      });
      return { skipped: true, reason: "not_found" };
    }

    const daysRemaining = differenceInDays(user.endsAt, new Date());
    const MAX_THRESHOLD_DAYS = 7;

    // Skip if beyond max threshold or already expired
    if (daysRemaining > MAX_THRESHOLD_DAYS || daysRemaining < 0) {
      return { skipped: true, reason: "out_of_range", daysRemaining };
    }

    const threshold = getSubscriptionExpiryThreshold(daysRemaining);
    if (!threshold) {
      return { skipped: true, reason: "no_threshold_met", daysRemaining };
    }

    // Check if we've already sent this threshold (or a more urgent one)
    if (!shouldSendNotification(threshold, user.lastExpiryNotification)) {
      return {
        skipped: true,
        reason: "already_sent",
        lastSent: user.lastExpiryNotification,
      };
    }

    // Send notification email
    const sent = await step.run("send-email", async () => {
      return await sendSubscriptionExpiryNotification(
        {
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          endsAt: new Date(user.endsAt),
          daysRemaining,
          threshold,
        },
        inngestLogger,
      );
    });

    if (sent) {
      await step.run("update-tracking", async () => {
        return await setLastExpiryNotification(userId, threshold);
      });
    }

    return { sent, threshold, daysRemaining };
  },
);

async function sendSubscriptionExpiryNotification(
  {
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
  },
  logger: Logger,
): Promise<boolean> {
  const idempotencyKey = generateSubscriptionIdempotencyKey(
    userId,
    threshold,
    endsAt,
  );

  try {
    const firstName = getFirstName(userName);
    const endDate = format(endsAt, "MMMM d, yyyy");

    // Determine urgency for subject line
    const isUrgent = daysRemaining <= 3;
    const subject = isUrgent
      ? `⚠️ Your Pro subscription ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
      : `Your Pro subscription ends on ${endDate}`;

    const { data, error } = await sendPrettyEmail(
      {
        to: userEmail,
        subject,
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
      logger.error("Failed to send subscription expiry email", error, {
        userId,
        idempotencyKey,
      });
      // Don't throw - we don't want to retry and potentially spam users
      return false;
    }

    logger.info("Sent subscription expiry notification", {
      userId,
      emailId: data?.id,
      daysRemaining,
      threshold,
      idempotencyKey,
    });

    return true;
  } catch (err) {
    logger.error("Error sending subscription expiry notification", err, {
      userId,
      idempotencyKey,
    });
    return false;
  }
}
