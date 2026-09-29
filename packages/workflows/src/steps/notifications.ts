/**
 * Tracked-domain notification delivery shared by the detect-changes, expiry, and
 * reverify-ownership workflows: `sendNotification` (called inside a step) and the
 * channel toggles it takes.
 */

import { FatalError } from "workflow";

import type { NotificationChannel, NotificationType } from "@domainstack/types";

export interface NotificationChannels {
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}

// ============================================================================
// Expiry notification helpers
// ============================================================================

/**
 * Step: Check user notification preferences for expiry notifications.
 *
 * Respects the muted flag on tracked domains.
 */
export async function checkExpiryPreferencesStep(
  userId: string,
  muted: boolean,
  preferenceKey: "domainExpiry" | "certificateExpiry",
): Promise<NotificationChannels> {
  "use step";

  // Muted domains receive no notifications
  if (muted) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const { getUserNotificationPreferences } =
    await import("@domainstack/db/queries/user-notification-preferences");

  const globalPrefs = await getUserNotificationPreferences(userId);

  return {
    shouldSendEmail: globalPrefs[preferenceKey].email,
    shouldSendInApp: globalPrefs[preferenceKey].inApp,
  };
}

/**
 * Step: Check if a notification was already sent for this domain and type.
 */
export async function checkAlreadySentStep(
  trackedDomainId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  "use step";

  const { hasRecentNotification } = await import("@domainstack/db/queries/notifications");

  return await hasRecentNotification(trackedDomainId, notificationType);
}

// ============================================================================
// Shared notification sending logic (used by every tracked-domain notification step)
// ============================================================================

/**
 * Consolidated logic for creating a notification record and optionally sending an email.
 * Used by all domain monitoring notification steps to ensure consistent behavior.
 *
 * Not a step — call it from inside a `"use step"` function so the email
 * idempotency key is that step's id.
 *
 * ## Idempotency Strategy
 *
 * Every caller runs this inside a `"use step"` function, so the whole body
 * re-runs from the top when the step is retried.
 *
 * 1. **Email first, record second**: writing the row before the send would
 *    leave one extra copy of the alert in the user's inbox view for every
 *    failed email attempt. Sending first means a failed attempt leaves no
 *    trace to duplicate, and the row is only written once delivery is
 *    confirmed.
 *
 * 2. **Email-level idempotency**: the send goes through `steps/email.ts`,
 *    which uses the enclosing step's id as the Resend idempotency key unless
 *    the caller provides one, so a retry after a partial failure re-sends the
 *    same mail without delivering it twice (~24-48 hour window). Keyed alerts
 *    (`dedupeKey`) use that key, so concurrent runs share one Resend key too.
 *
 * 3. **Atomic row dedupe for keyed alerts**: expiry and verification alerts
 *    pass a `dedupeKey` naming the logical episode. `createNotification`
 *    claims it with a unique constraint (`ON CONFLICT DO NOTHING`), so racing
 *    runs write one row; the loser returns `false` and leaves the winner's row
 *    (and its Resend id) untouched. Recurring change alerts pass no key: the
 *    same transition can legitimately happen again, and their emails dedupe
 *    through their own `idempotencyKey`. The callers' pre-send "already sent"
 *    checks stay in place: the email goes out before the row is written and
 *    Resend keys expire, so the key alone would not stop a later run from
 *    re-sending.
 *
 * 4. **Permanent email failures degrade to in-app only; transient ones throw
 *    for step retry.**
 *
 * After the send, the notification row is recorded. Database errors from that
 * insert are classified via `classifyDatabaseError`: transient failures retry
 * the step (the retried send is deduped by its idempotency key), constraint
 * or schema failures fail fast as `FatalError`. A falsy insert result without
 * an error is also fatal, and `updateNotificationResendId` swallows its own
 * errors.
 *
 * @throws {Error} If notification record creation fails or email sending fails
 */
export async function sendNotification(
  options: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    emailComponent?: React.ReactElement;
    emailSubject?: string;
    idempotencyKey?: string;
    /** Logical episode identity; makes the row insert atomic and keys the email. */
    dedupeKey?: string;
  },
  { shouldSendEmail, shouldSendInApp }: NotificationChannels,
): Promise<boolean> {
  const { createNotification, updateNotificationResendId } =
    await import("@domainstack/db/queries/notifications");
  const { isTrackedDomainNotificationEligible } =
    await import("@domainstack/db/queries/tracked-domains");
  const { createLogger } = await import("@domainstack/logger");

  const logger = createLogger({ source: "workflows/notifications" });

  const {
    userId,
    userEmail,
    trackedDomainId,
    domainName,
    notificationType,
    title,
    message,
    emailComponent,
    emailSubject,
    idempotencyKey,
    dedupeKey,
  } = options;

  if (!shouldSendEmail && !shouldSendInApp) return false;

  // Final just-in-time check: the domain may have been archived or unverified
  // since the run started (observation, confirmation, or step retries all leave
  // a window). Applies to every tracked-domain alert, regardless of channel
  // choices. Revocation alerts still pass: they send before verification is revoked.
  if (!(await isTrackedDomainNotificationEligible(trackedDomainId))) return false;

  const email =
    shouldSendEmail && emailComponent && emailSubject
      ? { react: emailComponent, subject: emailSubject }
      : null;

  let channels: NotificationChannel[] = [];
  if (email) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  // Send the email first so a retry after a failed send has no half-written
  // row to duplicate. Resend dedupes the delivery via the idempotency key.
  let emailId: string | null = null;
  if (email) {
    const { sendEmail } = await import("./email");
    try {
      // Classifies Resend errors and uses the enclosing step id as the
      // idempotency key, so a retry never delivers twice.
      const sent = await sendEmail({
        to: userEmail,
        subject: email.subject,
        react: email.react,
        idempotencyKey: idempotencyKey ?? dedupeKey,
      });
      emailId = sent.emailId;
    } catch (err) {
      // Transient failures: let the step retry.
      if (!FatalError.is(err)) throw err;

      // Permanent failures (bad address, quota): retrying cannot succeed and
      // failing the run would stall monitoring for this domain. Deliver
      // in-app only and let the caller advance its snapshot.
      logger.error(
        { err, trackedDomainId, notificationType },
        "change alert email failed permanently; recording in-app only",
      );
      channels = channels.filter((c) => c !== "email");
    }
  }

  if (channels.length === 0) return false;

  // Record the notification only once delivery is settled.
  let result: Awaited<ReturnType<typeof createNotification>>;
  try {
    result = await createNotification({
      userId,
      trackedDomainId,
      type: notificationType,
      title,
      message,
      data: { domainName },
      channels,
      dedupeKey,
    });
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `creating notification record for ${domainName}` });
  }

  // A concurrent run already recorded this episode; leave its row alone.
  if (!result.created) return false;

  const { notification } = result;
  if (!notification) {
    // An insert that returns no row without raising is not retryable.
    throw new FatalError("Failed to create notification record in database");
  }

  if (emailId) {
    await updateNotificationResendId(notification.id, emailId);
  }

  return true;
}
