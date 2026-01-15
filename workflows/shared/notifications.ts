/**
 * Shared notification workflow steps.
 *
 * These steps handle notification channel determination, provider name resolution,
 * and notification sending for monitoring workflows.
 */

import type { NotificationType } from "@/lib/constants/notifications";
import type { NotificationOverrides } from "@/lib/types/notifications";

export interface NotificationChannels {
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}

/**
 * Step: Determine which notification channels to use based on user preferences.
 */
export async function determineNotificationChannelsStep(
  userId: string,
  trackedDomainId: string,
  preferenceType: keyof NotificationOverrides,
): Promise<NotificationChannels> {
  "use step";

  const { findTrackedDomainById } = await import(
    "@/lib/db/repos/tracked-domains"
  );
  const { getOrCreateUserNotificationPreferences } = await import(
    "@/lib/db/repos/user-notification-preferences"
  );

  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

  // Check for per-domain overrides first
  const override = trackedDomain.notificationOverrides[preferenceType];

  if (override !== undefined) {
    // Use domain-specific override
    return {
      shouldSendEmail: override.email,
      shouldSendInApp: override.inApp,
    };
  }

  // Fall back to global preferences
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

  const { getProviderNames } = await import("@/lib/db/repos/providers");

  return await getProviderNames(providerIds);
}

// ============================================================================
// Shared notification sending logic (used by send*NotificationStep functions)
// ============================================================================

/**
 * Consolidated logic for creating a notification record and optionally sending an email.
 * Used by all domain monitoring notification steps to ensure consistent behavior.
 *
 * ## Idempotency Strategy
 *
 * This function uses a two-layer idempotency approach to handle workflow retries gracefully:
 *
 * 1. **Database-level deduplication**: Callers typically check `hasRecentNotification()` before
 *    calling this function, preventing duplicate notifications within a time window (usually 30 days).
 *    This protects against multiple workflow runs for the same event.
 *
 * 2. **Email-level idempotency**: Resend's idempotency key (format: `{stepId}`)
 *    prevents duplicate emails if this function is retried within Resend's idempotency window (~24-48 hours).
 *    This protects against transient failures during email sending.
 *
 * @throws {Error} If notification record creation fails or email sending fails
 */
async function sendNotificationInternal(
  options: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    idempotencyKey?: string;
    emailComponent?: React.ReactElement;
    emailSubject?: string;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  const { createNotification, updateNotificationResendId } = await import(
    "@/lib/db/repos/notifications"
  );
  const { createLogger } = await import("@/lib/logger/server");
  const { sendEmail } = await import("@/lib/resend");

  const {
    userId,
    userEmail,
    trackedDomainId,
    domainName,
    notificationType,
    title,
    message,
    idempotencyKey,
    emailComponent,
    emailSubject,
  } = options;

  const logger = createLogger({ source: "notifications" });

  if (!shouldSendEmail && !shouldSendInApp) return false;

  const channels: string[] = [];
  if (shouldSendEmail && emailComponent && emailSubject) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  try {
    // Create notification record
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
      logger.error(
        { trackedDomainId, notificationType, domainName },
        "Failed to create notification record",
      );
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification if enabled and component provided
    if (shouldSendEmail && emailComponent && emailSubject) {
      const { data, error } = await sendEmail(
        {
          to: userEmail,
          subject: emailSubject,
          react: emailComponent,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      if (error) throw new Error(`Resend error: ${error.message}`);

      // Update notification with email ID
      if (data?.id) {
        await updateNotificationResendId(notification.id, data.id);
      }
    }

    return true;
  } catch (err) {
    logger.error(
      { err, domainName, userId, idempotencyKey },
      `Error sending ${notificationType} notification`,
    );
    throw err;
  }
}

// ============================================================================
// Notification sending steps
// ============================================================================

/**
 * Step: Send registration change notification via email and/or in-app.
 *
 * Uses step ID as idempotency key.
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
    changes: {
      registrarChanged: boolean;
      nameserversChanged: boolean;
      transferLockChanged: boolean;
      statusesChanged: boolean;
      previousRegistrar?: string;
      newRegistrar?: string;
      previousNameservers: { host: string }[];
      newNameservers: { host: string }[];
      previousTransferLock?: boolean;
      newTransferLock?: boolean;
      previousStatuses: string[];
      newStatuses: string[];
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { default: RegistrationChangeEmail } = await import(
    "@/emails/registration-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = RegistrationChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
  });

  return await sendNotificationInternal(
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
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send provider change notification via email and/or in-app.
 *
 * Uses step ID as idempotency key.
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
    changes: {
      dnsProviderChanged: boolean;
      hostingProviderChanged: boolean;
      emailProviderChanged: boolean;
      previousDnsProviderId: string | null;
      newDnsProviderId: string | null;
      previousHostingProviderId: string | null;
      newHostingProviderId: string | null;
      previousEmailProviderId: string | null;
      newEmailProviderId: string | null;
      previousDnsProvider: string | null;
      newDnsProvider: string | null;
      previousHostingProvider: string | null;
      newHostingProvider: string | null;
      previousEmailProvider: string | null;
      newEmailProvider: string | null;
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { default: ProviderChangeEmail } = await import(
    "@/emails/provider-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = ProviderChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
  });

  return await sendNotificationInternal(
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
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send certificate change notification via email and/or in-app.
 *
 * Uses step ID as idempotency key.
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
    changes: {
      caProviderChanged: boolean;
      issuerChanged: boolean;
      previousCaProviderId: string | null;
      newCaProviderId: string | null;
      previousIssuer: string | null;
      newIssuer: string | null;
      previousCaProvider: string | null;
      newCaProvider: string | null;
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { default: CertificateChangeEmail } = await import(
    "@/emails/certificate-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = CertificateChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
    newValidTo: params.newValidTo,
  });

  return await sendNotificationInternal(
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
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}
