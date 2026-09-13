import {
  calculateDaysRemainingStep,
  checkAlreadySentStep,
  checkExpiryPreferencesStep,
  getThresholdNotificationType,
} from "@/workflows/shared/notifications";
import { CERTIFICATE_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainCertificate } from "@domainstack/db/queries/certificates";
import type { NotificationType } from "@domainstack/types";
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

  // Step 7: Send and record. Email goes first inside the step so a failed send
  // leaves no dedup row behind (see sendNotification in shared/notifications.ts).
  await sendCertificateExpiryNotification(
    {
      userId: cert.userId,
      userEmail: cert.userEmail,
      userName: cert.userName,
      trackedDomainId,
      domainName: cert.domainName,
      notificationType,
      title,
      message,
      subject,
      validTo,
      issuer: cert.issuer,
      daysRemaining,
    },
    prefs.shouldSendEmail,
    prefs.shouldSendInApp,
  );

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

async function sendCertificateExpiryNotification(
  params: {
    userId: string;
    userEmail: string;
    userName: string;
    trackedDomainId: string;
    domainName: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    subject: string;
    validTo: Date;
    issuer: string;
    daysRemaining: number;
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { default: CertificateExpiryEmail } =
    await import("@domainstack/email/templates/certificate-expiry");
  const { sendNotification } = await import("@/workflows/shared/notifications");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: params.notificationType,
      title: params.title,
      message: params.message,
      emailSubject: params.subject,
      emailComponent: CertificateExpiryEmail({
        userName: params.userName.split(" ")[0] || "there",
        domainName: params.domainName,
        expirationDate: formatDateLong(params.validTo),
        daysRemaining: params.daysRemaining,
        issuer: params.issuer,
        baseUrl,
      }),
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}
