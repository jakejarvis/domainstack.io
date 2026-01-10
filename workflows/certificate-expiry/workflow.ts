import { differenceInDays, format } from "date-fns";
import { FatalError } from "workflow";
import type { NotificationType } from "@/lib/constants/notifications";

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

  // Step 6: Create notification record
  const { notificationId, subject } = await createNotificationRecord({
    trackedDomainId,
    domainName: cert.domainName,
    userId: cert.userId,
    validTo,
    issuer: cert.issuer,
    daysRemaining,
    notificationType,
    shouldSendEmail: prefs.shouldSendEmail,
    shouldSendInApp: prefs.shouldSendInApp,
  });

  // Step 7: Send email if enabled
  if (prefs.shouldSendEmail) {
    const { emailId } = await sendCertificateExpiryEmail({
      userEmail: cert.userEmail,
      userName: cert.userName,
      domainName: cert.domainName,
      validTo,
      issuer: cert.issuer,
      daysRemaining,
      subject,
    });

    // Step 8: Update notification with email ID
    await updateNotificationWithEmailId(notificationId, emailId);
  }

  return { skipped: false, sent: true };
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

async function createNotificationRecord(params: {
  trackedDomainId: string;
  domainName: string;
  userId: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
  notificationType: NotificationType;
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}): Promise<{ notificationId: string; title: string; subject: string }> {
  "use step";

  const { createNotification } = await import("@/lib/db/repos/notifications");

  const {
    trackedDomainId,
    domainName,
    userId,
    validTo,
    issuer,
    daysRemaining,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
  } = params;

  const title = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}${title}`;
  const message = `The SSL certificate for ${domainName} (issued by ${issuer}) will expire on ${format(validTo, "MMMM d, yyyy")}.`;

  const channels: string[] = [];
  if (shouldSendEmail) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

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
    throw new FatalError(
      `Failed to create notification record: ${notificationType} for ${domainName}`,
    );
  }

  return { notificationId: notification.id, title, subject };
}

async function sendCertificateExpiryEmail(params: {
  userEmail: string;
  userName: string;
  domainName: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
  subject: string;
}): Promise<{ emailId: string }> {
  "use step";

  const { default: CertificateExpiryEmail } = await import(
    "@/emails/certificate-expiry"
  );
  const { sendEmail } = await import("@/workflows/shared/send-email");

  const {
    userEmail,
    userName,
    domainName,
    validTo,
    issuer,
    daysRemaining,
    subject,
  } = params;

  const result = await sendEmail({
    to: userEmail,
    subject,
    react: CertificateExpiryEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      expirationDate: format(validTo, "MMMM d, yyyy"),
      daysRemaining,
      issuer,
    }),
  });

  return { emailId: result.emailId };
}

async function updateNotificationWithEmailId(
  notificationId: string,
  emailId: string,
): Promise<void> {
  "use step";

  const { updateNotificationResendId } = await import(
    "@/lib/db/repos/notifications"
  );

  await updateNotificationResendId(notificationId, emailId);
}
