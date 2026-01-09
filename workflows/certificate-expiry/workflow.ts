import { differenceInDays, format } from "date-fns";
import { getWorkflowMetadata } from "workflow";
import type { NotificationType } from "@/lib/types";

export interface CertificateExpiryWorkflowInput {
  trackedDomainId: string;
}

export type CertificateExpiryWorkflowResult =
  | { skipped: true; reason: string; clearedCount?: number; renewed?: boolean }
  | { skipped: false; sent: boolean };

/**
 * Durable workflow to check certificate expiry and send notifications.
 *
 * Checks if a tracked domain's SSL certificate is approaching expiration
 * and sends notifications based on user preferences.
 */
export async function certificateExpiryWorkflow(
  input: CertificateExpiryWorkflowInput,
): Promise<CertificateExpiryWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  // Step 1: Fetch certificate data
  const cert = await fetchCertificate(trackedDomainId);

  if (!cert) {
    return { skipped: true, reason: "not_found" };
  }

  // Step 2: Calculate days remaining
  const validTo = new Date(cert.validTo);
  const daysRemaining = differenceInDays(validTo, new Date());
  const MAX_THRESHOLD_DAYS = 14;

  // Detect renewal: If certificate is renewed beyond our notification window
  if (daysRemaining > MAX_THRESHOLD_DAYS) {
    const cleared = await clearRenewedNotifications(trackedDomainId);
    return {
      skipped: true,
      reason: "renewed",
      renewed: true,
      clearedCount: cleared,
    };
  }

  // Step 3: Determine notification type
  const notificationType = getCertificateExpiryNotificationType(daysRemaining);
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  // Step 4: Check notification preferences
  const prefs = await checkPreferences(cert.userId, cert.notificationOverrides);
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySent(trackedDomainId, notificationType);
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  // Step 6: Send notification
  const sent = await sendCertificateExpiryNotification({
    trackedDomainId,
    domainName: cert.domainName,
    userId: cert.userId,
    userName: cert.userName,
    userEmail: cert.userEmail,
    validTo,
    issuer: cert.issuer,
    daysRemaining,
    notificationType,
    shouldSendEmail: prefs.shouldSendEmail,
    shouldSendInApp: prefs.shouldSendInApp,
  });

  return { skipped: false, sent };
}

// Certificate expiry thresholds (days before expiration)
const CERTIFICATE_EXPIRY_THRESHOLDS = [14, 7, 3, 1] as const;
const SORTED_THRESHOLDS = [...CERTIFICATE_EXPIRY_THRESHOLDS].sort(
  (a, b) => a - b,
);

function getCertificateExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  for (const threshold of SORTED_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return `certificate_expiry_${threshold}d` as NotificationType;
    }
  }
  return null;
}

interface CertificateData {
  userId: string;
  userName: string;
  userEmail: string;
  domainName: string;
  validTo: Date;
  issuer: string;
  notificationOverrides: {
    certificateExpiry?: { email: boolean; inApp: boolean };
  };
}

async function fetchCertificate(
  trackedDomainId: string,
): Promise<CertificateData | null> {
  "use step";

  const { getEarliestCertificate } = await import(
    "@/lib/db/repos/certificates"
  );

  return await getEarliestCertificate(trackedDomainId);
}

async function clearRenewedNotifications(
  trackedDomainId: string,
): Promise<number> {
  "use step";

  const { clearCertificateExpiryNotifications } = await import(
    "@/lib/db/repos/notifications"
  );

  return await clearCertificateExpiryNotifications(trackedDomainId);
}

async function checkPreferences(
  userId: string,
  notificationOverrides: {
    certificateExpiry?: { email: boolean; inApp: boolean };
  },
): Promise<{ shouldSendEmail: boolean; shouldSendInApp: boolean }> {
  "use step";

  const { getOrCreateUserNotificationPreferences } = await import(
    "@/lib/db/repos/user-notification-preferences"
  );

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

  // Check for domain-specific override
  const override = notificationOverrides.certificateExpiry;
  if (override !== undefined) {
    return {
      shouldSendEmail: override.email,
      shouldSendInApp: override.inApp,
    };
  }

  // Fall back to global preferences
  return {
    shouldSendEmail: globalPrefs.certificateExpiry.email,
    shouldSendInApp: globalPrefs.certificateExpiry.inApp,
  };
}

async function checkAlreadySent(
  trackedDomainId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  "use step";

  const { hasRecentNotification } = await import(
    "@/lib/db/repos/notifications"
  );

  return await hasRecentNotification(trackedDomainId, notificationType);
}

async function sendCertificateExpiryNotification(params: {
  trackedDomainId: string;
  domainName: string;
  userId: string;
  userName: string;
  userEmail: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
  notificationType: NotificationType;
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}): Promise<boolean> {
  "use step";

  const { CertificateExpiryEmail } = await import(
    "@/emails/certificate-expiry"
  );
  const { createNotification, updateNotificationResendId } = await import(
    "@/lib/db/repos/notifications"
  );
  const { sendPrettyEmail } = await import("@/lib/resend");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "certificate-expiry-workflow" });
  const {
    trackedDomainId,
    domainName,
    userId,
    userName,
    userEmail,
    validTo,
    issuer,
    daysRemaining,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
  } = params;

  // Use workflow run ID as idempotency key - ensures exactly-once delivery
  const { workflowRunId } = getWorkflowMetadata();
  const idempotencyKey = `${workflowRunId}:send-certificate-expiry-notification`;

  const title = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}${title}`;
  const message = `The SSL certificate for ${domainName} (issued by ${issuer}) will expire on ${format(validTo, "MMMM d, yyyy")}.`;

  const channels: string[] = [];
  if (shouldSendEmail) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  try {
    // Create in-app notification first
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

    // Send email notification if enabled
    if (shouldSendEmail) {
      const { data, error } = await sendPrettyEmail(
        {
          to: userEmail,
          subject,
          react: CertificateExpiryEmail({
            userName: userName.split(" ")[0] || "there",
            domainName,
            expirationDate: format(validTo, "MMMM d, yyyy"),
            daysRemaining,
            issuer,
          }),
        },
        { idempotencyKey },
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
      "Error sending certificate expiry notification",
    );
    throw err;
  }
}
