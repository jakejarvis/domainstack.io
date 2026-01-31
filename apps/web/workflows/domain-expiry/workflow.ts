import type { NotificationType } from "@domainstack/constants";
import { FatalError } from "workflow";
import {
  calculateDaysRemainingStep,
  checkAlreadySentStep,
  checkExpiryPreferencesStep,
  getThresholdNotificationType,
  updateNotificationEmailIdStep,
} from "@/workflows/shared/notifications";

export interface DomainExpiryWorkflowInput {
  trackedDomainId: string;
}

export type DomainExpiryWorkflowResult =
  | { skipped: true; reason: string; clearedCount?: number; renewed?: boolean }
  | { skipped: false; sent: boolean };

/**
 * Durable workflow to check domain expiry and send notifications.
 *
 * Checks if a tracked domain is approaching expiration and sends
 * notifications based on user preferences.
 */
export async function domainExpiryWorkflow(
  input: DomainExpiryWorkflowInput,
): Promise<DomainExpiryWorkflowResult> {
  "use workflow";

  const { trackedDomainId } = input;

  // Step 1: Fetch domain data
  const domain = await fetchDomain(trackedDomainId);

  if (!domain) {
    return { skipped: true, reason: "not_found" };
  }

  if (!domain.expirationDate) {
    return { skipped: true, reason: "no_expiration_date" };
  }

  // Step 2: Calculate days remaining and check for renewal
  const daysRemaining = await calculateDaysRemainingStep(domain.expirationDate);
  const MAX_THRESHOLD_DAYS = 30;

  // Detect renewal: If expiration is now beyond our notification window,
  // clear previous notifications so they can be re-sent when approaching expiry again.
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
    DOMAIN_EXPIRY_THRESHOLDS,
    "domain_expiry",
  ) as NotificationType | null;
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  // Step 4: Check notification preferences
  const prefs = await checkExpiryPreferencesStep(
    domain.userId,
    domain.muted,
    "domainExpiry",
  );
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySentStep(
    trackedDomainId,
    notificationType,
  );
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  // Step 6: Create notification record
  const expirationDate = new Date(domain.expirationDate);
  const { notificationId, subject } = await createNotificationRecord({
    trackedDomainId,
    domainName: domain.domainName,
    userId: domain.userId,
    expirationDate,
    daysRemaining,
    registrar: domain.registrar ?? undefined,
    notificationType,
    shouldSendEmail: prefs.shouldSendEmail,
    shouldSendInApp: prefs.shouldSendInApp,
  });

  // Step 7: Send email if enabled
  if (prefs.shouldSendEmail) {
    const { emailId } = await sendDomainExpiryEmail({
      userEmail: domain.userEmail,
      userName: domain.userName,
      domainName: domain.domainName,
      expirationDate,
      daysRemaining,
      registrar: domain.registrar ?? undefined,
      subject,
    });

    // Step 8: Update notification with email ID
    await updateNotificationEmailIdStep(notificationId, emailId);
  }

  return { skipped: false, sent: true };
}

// Domain expiry thresholds (days before expiration)
const DOMAIN_EXPIRY_THRESHOLDS = [30, 14, 7, 1] as const;

interface DomainData {
  userId: string;
  userName: string;
  userEmail: string;
  domainName: string;
  expirationDate: Date | string | null;
  registrar: string | null;
  muted: boolean;
}

async function fetchDomain(
  trackedDomainId: string,
): Promise<DomainData | null> {
  "use step";

  const { getTrackedDomainForNotification } = await import(
    "@domainstack/db/queries"
  );

  return await getTrackedDomainForNotification(trackedDomainId);
}

async function clearRenewedNotifications(
  trackedDomainId: string,
): Promise<number> {
  "use step";

  const { clearDomainExpiryNotifications } = await import(
    "@domainstack/db/queries"
  );

  return await clearDomainExpiryNotifications(trackedDomainId);
}

async function createNotificationRecord(params: {
  trackedDomainId: string;
  domainName: string;
  userId: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
  notificationType: NotificationType;
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}): Promise<{ notificationId: string; title: string; subject: string }> {
  "use step";

  const { format } = await import("date-fns");
  const { createNotification } = await import("@domainstack/db/queries");

  const {
    trackedDomainId,
    domainName,
    userId,
    expirationDate,
    daysRemaining,
    registrar,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
  } = params;

  const title = `${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 7 ? "⚠️ " : ""}${title}`;
  const message = `Your domain ${domainName} will expire on ${format(expirationDate, "MMMM d, yyyy")}${registrar ? ` (registered with ${registrar})` : ""}.`;

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

async function sendDomainExpiryEmail(params: {
  userEmail: string;
  userName: string;
  domainName: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
  subject: string;
}): Promise<{ emailId: string }> {
  "use step";

  const { format } = await import("date-fns");
  const { default: DomainExpiryEmail } = await import(
    "@domainstack/email/templates/domain-expiry"
  );
  const { sendEmail } = await import("@/workflows/shared/send-email");

  const {
    userEmail,
    userName,
    domainName,
    expirationDate,
    daysRemaining,
    registrar,
    subject,
  } = params;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;

  const result = await sendEmail({
    to: userEmail,
    subject,
    react: DomainExpiryEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      expirationDate: format(expirationDate, "MMMM d, yyyy"),
      daysRemaining,
      registrar,
      baseUrl,
    }),
  });

  return { emailId: result.emailId };
}
