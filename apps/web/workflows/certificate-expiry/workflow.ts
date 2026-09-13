import { FatalError } from "workflow";

import {
  calculateDaysRemainingStep,
  checkAlreadySentStep,
  checkExpiryPreferencesStep,
  getThresholdNotificationType,
} from "@/workflows/shared/notifications";
import { CERTIFICATE_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainCertificate } from "@domainstack/db/queries/certificates";
import type { NotificationChannel, NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";

interface CertificateExpiryWorkflowInput {
  trackedDomainId: string;
}

type CertificateExpiryWorkflowResult =
  | {
      skipped: true;
      reason: "renewed";
      renewed: true;
      clearedCount: number;
    }
  | {
      skipped: true;
      reason:
        | "not_found"
        | "already_expired"
        | "no_threshold_met"
        | "notifications_disabled"
        | "already_sent";
    }
  | { skipped: false; sent: true };

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
  const validTo = cert.validTo;

  const daysRemaining = await calculateDaysRemainingStep(validTo);
  const MAX_THRESHOLD_DAYS = Math.max(...CERTIFICATE_EXPIRY_THRESHOLDS);

  // The cron starts this workflow for every verified tracked domain holding a
  // certificate, so an already-expired one reaches us here. The thresholds only
  // describe an approaching expiry and getThresholdNotificationType maps
  // anything at or below the smallest one, so without this guard an expired
  // certificate alerts "expires in -12 days".
  if (daysRemaining < 0) {
    return { skipped: true, reason: "already_expired" };
  }

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
  const notificationType = getThresholdNotificationType(
    daysRemaining,
    CERTIFICATE_EXPIRY_THRESHOLDS,
    "certificate_expiry",
  );
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  // Step 4: Check notification preferences
  const prefs = await checkExpiryPreferencesStep(cert.userId, cert.muted, "certificateExpiry");
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySentStep(trackedDomainId, notificationType);
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  // Step 6: Build the notification content (pure — no I/O, safe to recompute)
  const { title, subject, message } = buildCertificateExpiryContent({
    domainName: cert.domainName,
    validTo,
    issuer: cert.issuer,
    daysRemaining,
  });

  // Step 7: Send the email FIRST. A failed send must leave no row behind —
  // the row is the 30-day dedup key, so recording it before a failed send
  // would suppress this warning for 30 days. See the idempotency contract in
  // apps/web/workflows/shared/notifications.ts.
  let emailId: string | undefined;
  if (prefs.shouldSendEmail) {
    const sent = await sendCertificateExpiryEmail({
      userEmail: cert.userEmail,
      userName: cert.userName,
      domainName: cert.domainName,
      validTo,
      issuer: cert.issuer,
      daysRemaining,
      subject,
    });
    emailId = sent.emailId;
  }

  // Step 8: Record the notification only after delivery is confirmed.
  await createNotificationRecord({
    trackedDomainId,
    domainName: cert.domainName,
    userId: cert.userId,
    title,
    message,
    notificationType,
    shouldSendEmail: prefs.shouldSendEmail,
    shouldSendInApp: prefs.shouldSendInApp,
    resendId: emailId,
  });

  return { skipped: false, sent: true };
}

async function fetchCertificate(trackedDomainId: string): Promise<TrackedDomainCertificate | null> {
  "use step";

  const { getEarliestCertificate } = await import("@domainstack/db/queries/certificates");

  return await getEarliestCertificate(trackedDomainId);
}

async function clearRenewedNotifications(trackedDomainId: string): Promise<number> {
  "use step";

  const { clearCertificateExpiryNotifications } =
    await import("@domainstack/db/queries/notifications");

  return await clearCertificateExpiryNotifications(trackedDomainId);
}

function buildCertificateExpiryContent(params: {
  domainName: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
}): { title: string; subject: string; message: string } {
  const { domainName, validTo, issuer, daysRemaining } = params;

  const title = `SSL certificate for ${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 3 ? "🔒⚠️ " : "🔒 "}${title}`;
  const message = `The SSL certificate for ${domainName} (issued by ${issuer}) will expire on ${formatDateLong(validTo)}.`;

  return { title, subject, message };
}

async function createNotificationRecord(params: {
  trackedDomainId: string;
  domainName: string;
  userId: string;
  title: string;
  message: string;
  notificationType: NotificationType;
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
  resendId?: string;
}): Promise<void> {
  "use step";

  const { createNotification, updateNotificationResendId } =
    await import("@domainstack/db/queries/notifications");

  const {
    trackedDomainId,
    domainName,
    userId,
    title,
    message,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
    resendId,
  } = params;

  const channels: NotificationChannel[] = [];
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

  if (resendId) {
    await updateNotificationResendId(notification.id, resendId);
  }
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

  const { default: CertificateExpiryEmail } =
    await import("@domainstack/email/templates/certificate-expiry");
  const { getEmailBaseUrl, sendEmail } = await import("@/workflows/shared/send-email");

  const { userEmail, userName, domainName, validTo, issuer, daysRemaining, subject } = params;

  const baseUrl = getEmailBaseUrl();

  const result = await sendEmail({
    to: userEmail,
    subject,
    react: CertificateExpiryEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      expirationDate: formatDateLong(validTo),
      daysRemaining,
      issuer,
      baseUrl,
    }),
  });

  return { emailId: result.emailId };
}
