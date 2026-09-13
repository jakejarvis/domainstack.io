/**
 * Shared notification workflow steps.
 *
 * These steps handle notification channel determination, provider name resolution,
 * and notification sending for monitoring and expiry workflows.
 */

import { FatalError } from "workflow";

import type {
  CertificateChangeKind,
  CertificateChangeWithNames,
  NotificationChannel,
  NotificationType,
  ProviderChangeWithNames,
  RegistrationChange,
  UserNotificationPreferences,
} from "@domainstack/types";

// Re-export expiry utilities from utils
export { getThresholdNotificationType } from "@domainstack/utils/expiry";

interface NotificationChannels {
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}

/**
 * Step: Determine which notification channels to use based on user preferences.
 *
 * If the domain is muted, returns false for both channels.
 * Otherwise, falls back to global preferences.
 */
export async function determineNotificationChannelsStep(
  userId: string,
  trackedDomainId: string,
  preferenceType: keyof UserNotificationPreferences,
): Promise<NotificationChannels> {
  "use step";

  const { findTrackedDomainById } = await import("@domainstack/db/queries/tracked-domains");
  const { getOrCreateUserNotificationPreferences } =
    await import("@domainstack/db/queries/user-notification-preferences");

  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  // Muted domains receive no notifications
  if (trackedDomain.muted) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  // Fall back to global preferences
  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);
  const globalPref = globalPrefs[preferenceType];
  return {
    shouldSendEmail: globalPref.email,
    shouldSendInApp: globalPref.inApp,
  };
}

/**
 * Step: Resolve provider names from provider IDs.
 *
 * Returns a map of provider ID to provider name.
 */
export async function resolveProviderNamesStep(
  providerIds: string[],
): Promise<Map<string, string>> {
  "use step";

  if (providerIds.length === 0) return new Map();

  const { getProviderNames } = await import("@domainstack/db/queries/providers");

  return await getProviderNames(providerIds);
}

// ============================================================================
// Expiry notification helpers
// ============================================================================

/**
 * Step: Calculate days remaining until expiration.
 *
 * Getting current time inside a step ensures deterministic replay.
 */
export async function calculateDaysRemainingStep(expirationDate: Date | string): Promise<number> {
  "use step";

  const { calculateDaysRemaining } = await import("@domainstack/utils/expiry");

  return calculateDaysRemaining(expirationDate);
}

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

  const { getOrCreateUserNotificationPreferences } =
    await import("@domainstack/db/queries/user-notification-preferences");

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

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
 * 1. **Email first, record second**: `createNotification` is a plain insert with
 *    no deduplication, so writing the row before the send would leave one extra
 *    copy of the alert in the user's inbox view for every failed email attempt.
 *    Sending first means a failed attempt leaves no trace to duplicate, and the
 *    row is only written once delivery is confirmed.
 *
 * 2. **Email-level idempotency**: the send goes through `shared/send-email.ts`,
 *    which uses the enclosing step's id as the Resend idempotency key, so a
 *    retry after a partial failure re-sends the same mail without delivering
 *    it twice (~24-48 hour window).
 *
 * 3. **Permanent email failures degrade to in-app only; transient ones throw
 *    for step retry.**
 *
 * After the send, the notification row is recorded. Database errors from that
 * insert propagate and retry the step; the retried send is deduped by its
 * idempotency key. A falsy insert result without an error is fatal, and
 * `updateNotificationResendId` swallows its own errors.
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
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  const { createNotification, updateNotificationResendId } =
    await import("@domainstack/db/queries/notifications");
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
  } = options;

  if (!shouldSendEmail && !shouldSendInApp) return false;

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
    const { sendEmail } = await import("@/workflows/shared/send-email");
    try {
      // Classifies Resend errors and uses the enclosing step id as the
      // idempotency key, so a retry never delivers twice.
      const sent = await sendEmail({
        to: userEmail,
        subject: email.subject,
        react: email.react,
        idempotencyKey,
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
  const notification = await createNotification({
    userId,
    trackedDomainId,
    type: notificationType,
    title,
    message,
    data: { domainName },
    channels,
  });

  if (!notification) {
    // An insert that returns no row without raising is not retryable.
    throw new FatalError("Failed to create notification record in database");
  }

  if (emailId) {
    await updateNotificationResendId(notification.id, emailId);
  }

  return true;
}

// ============================================================================
// Notification sending steps
// ============================================================================

/**
 * Step: Send registration change notification via email and/or in-app.
 *
 * The email is deduped by `params.idempotencyKey`, which identifies the change.
 */
export async function sendRegistrationChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    changes: RegistrationChange;
    idempotencyKey: string;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  let emailComponent: React.ReactElement | undefined;
  if (shouldSendEmail) {
    const { default: RegistrationChangeEmail } =
      await import("@domainstack/email/templates/registration-change");
    const { getEmailBaseUrl } = await import("@/workflows/shared/send-email");
    emailComponent = RegistrationChangeEmail({
      userName: params.userName.split(" ")[0] || "there",
      domainName: params.domainName,
      changes: params.changes,
      baseUrl: getEmailBaseUrl(),
    });
  }

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "registration_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: params.idempotencyKey,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send provider change notification via email and/or in-app.
 *
 * The email is deduped by `params.idempotencyKey`, which identifies the change.
 */
export async function sendProviderChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    changes: ProviderChangeWithNames;
    idempotencyKey: string;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  let emailComponent: React.ReactElement | undefined;
  if (shouldSendEmail) {
    const { default: ProviderChangeEmail } =
      await import("@domainstack/email/templates/provider-change");
    const { getEmailBaseUrl } = await import("@/workflows/shared/send-email");
    emailComponent = ProviderChangeEmail({
      userName: params.userName.split(" ")[0] || "there",
      domainName: params.domainName,
      changes: params.changes,
      baseUrl: getEmailBaseUrl(),
    });
  }

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "provider_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: params.idempotencyKey,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send certificate change notification via email and/or in-app.
 *
 * The email is deduped by `params.idempotencyKey`, which identifies the change.
 */
export async function sendCertificateChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    newValidTo: string;
    kind: CertificateChangeKind;
    changes: CertificateChangeWithNames;
    idempotencyKey: string;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  let emailComponent: React.ReactElement | undefined;
  if (shouldSendEmail) {
    const { default: CertificateChangeEmail } =
      await import("@domainstack/email/templates/certificate-change");
    const { getEmailBaseUrl } = await import("@/workflows/shared/send-email");
    emailComponent = CertificateChangeEmail({
      userName: params.userName.split(" ")[0] || "there",
      domainName: params.domainName,
      kind: params.kind,
      changes: params.changes,
      newValidTo: params.newValidTo,
      baseUrl: getEmailBaseUrl(),
    });
  }

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "certificate_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: params.idempotencyKey,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}
