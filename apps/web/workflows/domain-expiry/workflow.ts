import { differenceInDays, format } from "date-fns";
import { FatalError } from "workflow";
import type { NotificationType } from "@/lib/constants/notifications";

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
  // Note: We get current time in a step to ensure deterministic replay
  const daysRemaining = await calculateDaysRemaining(domain.expirationDate);
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
  const notificationType = getDomainExpiryNotificationType(daysRemaining);
  if (!notificationType) {
    return { skipped: true, reason: "no_threshold_met" };
  }

  // Step 4: Check notification preferences
  const prefs = await checkPreferences(domain.userId, domain.muted);
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySent(trackedDomainId, notificationType);
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
    await updateNotificationWithEmailId(notificationId, emailId);
  }

  return { skipped: false, sent: true };
}

// Domain expiry thresholds (days before expiration)
const DOMAIN_EXPIRY_THRESHOLDS = [30, 14, 7, 1] as const;
const SORTED_THRESHOLDS = [...DOMAIN_EXPIRY_THRESHOLDS].sort((a, b) => a - b);

function getDomainExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  for (const threshold of SORTED_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return `domain_expiry_${threshold}d` as NotificationType;
    }
  }
  return null;
}

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
    "@/lib/db/repos/tracked-domains"
  );

  return await getTrackedDomainForNotification(trackedDomainId);
}

async function calculateDaysRemaining(
  expirationDate: Date | string,
): Promise<number> {
  "use step";

  // Getting current time inside a step ensures deterministic replay
  const now = new Date();
  const expDate =
    typeof expirationDate === "string"
      ? new Date(expirationDate)
      : expirationDate;

  return differenceInDays(expDate, now);
}

async function clearRenewedNotifications(
  trackedDomainId: string,
): Promise<number> {
  "use step";

  const { clearDomainExpiryNotifications } = await import(
    "@/lib/db/repos/notifications"
  );

  return await clearDomainExpiryNotifications(trackedDomainId);
}

async function checkPreferences(
  userId: string,
  muted: boolean,
): Promise<{ shouldSendEmail: boolean; shouldSendInApp: boolean }> {
  "use step";

  // Muted domains receive no notifications
  if (muted) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const { getOrCreateUserNotificationPreferences } = await import(
    "@/lib/db/repos/user-notification-preferences"
  );

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

  // Use global preferences
  return {
    shouldSendEmail: globalPrefs.domainExpiry.email,
    shouldSendInApp: globalPrefs.domainExpiry.inApp,
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
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
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

  const { default: DomainExpiryEmail } = await import("@/emails/domain-expiry");
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

  const result = await sendEmail({
    to: userEmail,
    subject,
    react: DomainExpiryEmail({
      userName: userName.split(" ")[0] || "there",
      domainName,
      expirationDate: format(expirationDate, "MMMM d, yyyy"),
      daysRemaining,
      registrar,
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
