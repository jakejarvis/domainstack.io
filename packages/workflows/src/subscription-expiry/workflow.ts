import type { UserWithEndingSubscription } from "@domainstack/db/queries/user-subscription";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

interface SubscriptionExpiryWorkflowInput {
  userId: string;
}

type SubscriptionExpiryWorkflowResult =
  | {
      skipped: true;
      reason: "not_found";
    }
  | {
      skipped: true;
      reason: "out_of_range" | "no_threshold_met";
      daysRemaining: number;
    }
  | {
      skipped: true;
      reason: "already_sent";
      lastSent: number | null;
    }
  | {
      skipped: false;
      sent: true;
      threshold: SubscriptionExpiryThreshold;
      daysRemaining: number;
    };

// Thresholds for subscription expiry reminders (days before expiration)
const SUBSCRIPTION_EXPIRY_THRESHOLDS = [7, 3, 1] as const;
type SubscriptionExpiryThreshold = (typeof SUBSCRIPTION_EXPIRY_THRESHOLDS)[number];

// Pre-sorted ascending for threshold lookup (most urgent first)
const SORTED_THRESHOLDS = [...SUBSCRIPTION_EXPIRY_THRESHOLDS].sort((a, b) => a - b);
const MAX_THRESHOLD_DAYS = Math.max(...SUBSCRIPTION_EXPIRY_THRESHOLDS);

/**
 * Get the subscription expiry notification threshold for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 */
function getSubscriptionExpiryThreshold(daysRemaining: number): SubscriptionExpiryThreshold | null {
  for (const threshold of SORTED_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return threshold;
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

  // The workflow sandbox fixes `Date` per replay, so this needs no step.
  const daysRemaining = calculateDaysRemaining(user.endsAt);

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
  await sendSubscriptionExpiryNotification({
    userName: user.userName,
    userEmail: user.userEmail,
    endsAt: user.endsAt,
    daysRemaining,
  });

  await updateExpiryTracking(userId, threshold);

  return { skipped: false, sent: true, threshold, daysRemaining };
}

async function fetchUserSubscription(userId: string): Promise<UserWithEndingSubscription | null> {
  "use step";

  const { getUserWithEndingSubscription } =
    await import("@domainstack/db/queries/user-subscription");

  return await getUserWithEndingSubscription(userId);
}

async function updateExpiryTracking(userId: string, threshold: number): Promise<void> {
  "use step";

  const { setLastExpiryNotification } = await import("@domainstack/db/queries/user-subscription");

  try {
    await setLastExpiryNotification(userId, threshold);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `updating expiry tracking for ${userId}` });
  }
}

async function sendSubscriptionExpiryNotification(params: {
  userName: string;
  userEmail: string;
  endsAt: Date;
  daysRemaining: number;
}): Promise<void> {
  "use step";

  const { formatDateLong } = await import("@domainstack/utils/date");
  const { default: SubscriptionCancelingEmail } =
    await import("@domainstack/email/templates/subscription-canceling");
  const { getBaseUrl, getFirstName, sendEmail } = await import("../steps/email");

  const { userName, userEmail, endsAt, daysRemaining } = params;

  const firstName = getFirstName(userName);
  const endDate = formatDateLong(endsAt);
  const baseUrl = getBaseUrl();

  // Determine urgency for subject line
  const isUrgent = daysRemaining <= 3;
  const title = isUrgent
    ? `Pro subscription ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`
    : `Pro subscription ends on ${endDate}`;
  const subject = isUrgent ? `⚠️ Your ${title}` : `Your ${title}`;

  // Send email through the shared in-step helper (handles error classification).
  await sendEmail({
    to: userEmail,
    subject,
    react: SubscriptionCancelingEmail({
      userName: firstName,
      endDate,
      baseUrl,
    }),
  });
}
