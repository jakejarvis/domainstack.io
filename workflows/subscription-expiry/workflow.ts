import { differenceInDays, format } from "date-fns";

export interface SubscriptionExpiryWorkflowInput {
  userId: string;
}

export type SubscriptionExpiryWorkflowResult =
  | {
      skipped: true;
      reason: string;
      daysRemaining?: number;
      lastSent?: number | null;
    }
  | { skipped: false; sent: boolean; threshold: number; daysRemaining: number };

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
 * Check if we should send a notification for the given threshold.
 * Only sends if it's more urgent (smaller) than what we've already sent.
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
 * Durable workflow to check subscription expiry and send notifications.
 *
 * Checks if a user's Pro subscription is approaching expiration
 * and sends reminder emails at 7, 3, and 1 days before end.
 */
export async function subscriptionExpiryWorkflow(
  input: SubscriptionExpiryWorkflowInput,
): Promise<SubscriptionExpiryWorkflowResult> {
  "use workflow";

  const { userId } = input;

  // Step 1: Fetch user subscription data
  const user = await fetchUserSubscription(userId);

  if (!user) {
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
  const sent = await sendSubscriptionExpiryNotification({
    userId: user.userId,
    userName: user.userName,
    userEmail: user.userEmail,
    endsAt: new Date(user.endsAt),
    daysRemaining,
    threshold,
  });

  if (sent) {
    await updateExpiryTracking(userId, threshold);
  }

  return { skipped: false, sent, threshold, daysRemaining };
}

interface UserSubscriptionData {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  lastExpiryNotification: number | null;
}

async function fetchUserSubscription(
  userId: string,
): Promise<UserSubscriptionData | null> {
  "use step";

  const { getUserWithEndingSubscription } = await import(
    "@/lib/db/repos/user-subscription"
  );

  return await getUserWithEndingSubscription(userId);
}

async function updateExpiryTracking(
  userId: string,
  threshold: number,
): Promise<void> {
  "use step";

  const { setLastExpiryNotification } = await import(
    "@/lib/db/repos/user-subscription"
  );

  await setLastExpiryNotification(userId, threshold);
}

/**
 * Safely extract first name from a name string.
 * Handles null, undefined, empty, or whitespace-only names.
 */
function getFirstName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
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

async function sendSubscriptionExpiryNotification(params: {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  daysRemaining: number;
  threshold: SubscriptionExpiryThreshold;
}): Promise<boolean> {
  "use step";

  const SubscriptionCancelingEmail = (
    await import("@/emails/subscription-canceling")
  ).default;
  const { sendPrettyEmail } = await import("@/lib/resend");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "subscription-expiry-workflow" });
  const { userId, userName, userEmail, endsAt, daysRemaining, threshold } =
    params;

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
    const title = isUrgent
      ? `Pro subscription ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
      : `Pro subscription ends on ${endDate}`;
    const subject = isUrgent ? `⚠️ Your ${title}` : `Your ${title}`;

    const { error } = await sendPrettyEmail(
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
      logger.error(
        { err: error, userId, idempotencyKey },
        "Failed to send subscription expiry email",
      );
      // Don't throw - we don't want to retry and potentially spam users
      return false;
    }

    return true;
  } catch (err) {
    logger.error(
      { err, userId, idempotencyKey },
      "Error sending subscription expiry notification",
    );
    return false;
  }
}
