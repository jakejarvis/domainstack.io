import { CERTIFICATE_EXPIRY_THRESHOLDS } from "@domainstack/constants";
import type { TrackedDomainCertificate } from "@domainstack/db/queries/certificates";
import type { NotificationType } from "@domainstack/types";
import { formatDateLong } from "@domainstack/utils/date";

import { calculateDaysRemainingStep } from "../steps/notifications";
import { type ExpirySkipResult, evaluateExpiryNotification } from "./thresholds";

export interface CertificateExpiryWorkflowInput {
  trackedDomainId: string;
}

export type CertificateExpiryWorkflowResult =
  | ExpirySkipResult
  | { skipped: true; reason: "not_found" | "already_expired" }
  | { skipped: false; sent: true };

/**
 * Certificate expiry branch: checks if a tracked domain's leaf TLS
 * certificate is approaching expiration and sends notifications based on
 * user preferences.
 *
 * Not a workflow entrypoint itself — composed into `expiryWorkflow` in
 * `./workflow`, which owns the single durable-workflow boundary.
 */
export async function checkCertificateExpiry(
  input: CertificateExpiryWorkflowInput,
): Promise<CertificateExpiryWorkflowResult> {
  const { trackedDomainId } = input;

  // Step 1: Fetch certificate data
  const cert = await fetchCertificate(trackedDomainId);

  if (!cert) {
    return { skipped: true, reason: "not_found" };
  }

  // Step 2: Calculate days remaining
  const validTo = cert.validTo;

  const daysRemaining = await calculateDaysRemainingStep(validTo);

  // The cron starts this workflow for every verified tracked domain holding a
  // certificate, so an already-expired one reaches us here. The thresholds only
  // describe an approaching expiry and getThresholdNotificationType maps
  // anything at or below the smallest one, so without this guard an expired
  // certificate alerts "expires in -12 days".
  if (daysRemaining < 0) {
    return { skipped: true, reason: "already_expired" };
  }

  // Steps 3-5: renewal, threshold, preferences, and already-sent checks
  const check = await evaluateExpiryNotification({
    trackedDomainId,
    daysRemaining,
    thresholds: CERTIFICATE_EXPIRY_THRESHOLDS,
    prefix: "certificate_expiry",
    preferenceKey: "certificateExpiry",
    userId: cert.userId,
    muted: cert.muted,
    clearRenewed: clearRenewedNotifications,
  });
  if (check.skipped) return check;
  const { notificationType, prefs } = check;

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

interface CertificateExpiryContentInput {
  domainName: string;
  validTo: Date;
  issuer: string;
  daysRemaining: number;
}

interface ExpiryContent {
  title: string;
  subject: string;
  message: string;
}

function buildCertificateExpiryContent(params: CertificateExpiryContentInput): ExpiryContent {
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
  const { sendNotification } = await import("../steps/notifications");

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
