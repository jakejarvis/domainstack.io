import { differenceInDays, format } from "date-fns";
import type { NotificationType } from "@/lib/types";

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
  const expirationDate = new Date(domain.expirationDate);
  const daysRemaining = differenceInDays(expirationDate, new Date());
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
  const prefs = await checkPreferences(
    domain.userId,
    domain.notificationOverrides,
  );
  if (!prefs.shouldSendEmail && !prefs.shouldSendInApp) {
    return { skipped: true, reason: "notifications_disabled" };
  }

  // Step 5: Check if already sent
  const alreadySent = await checkAlreadySent(trackedDomainId, notificationType);
  if (alreadySent) {
    return { skipped: true, reason: "already_sent" };
  }

  // Step 6: Send notification
  const sent = await sendExpiryNotification({
    trackedDomainId,
    domainName: domain.domainName,
    userId: domain.userId,
    userName: domain.userName,
    userEmail: domain.userEmail,
    expirationDate,
    daysRemaining,
    registrar: domain.registrar ?? undefined,
    notificationType,
    shouldSendEmail: prefs.shouldSendEmail,
    shouldSendInApp: prefs.shouldSendInApp,
  });

  return { skipped: false, sent };
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
  notificationOverrides: {
    domainExpiry?: { email: boolean; inApp: boolean };
  };
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
  notificationOverrides: { domainExpiry?: { email: boolean; inApp: boolean } },
): Promise<{ shouldSendEmail: boolean; shouldSendInApp: boolean }> {
  "use step";

  const { getOrCreateUserNotificationPreferences } = await import(
    "@/lib/db/repos/user-notification-preferences"
  );

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

  // Check for domain-specific override
  const override = notificationOverrides.domainExpiry;
  if (override !== undefined) {
    return {
      shouldSendEmail: override.email,
      shouldSendInApp: override.inApp,
    };
  }

  // Fall back to global preferences
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

async function sendExpiryNotification(params: {
  trackedDomainId: string;
  domainName: string;
  userId: string;
  userName: string;
  userEmail: string;
  expirationDate: Date;
  daysRemaining: number;
  registrar?: string;
  notificationType: NotificationType;
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}): Promise<boolean> {
  "use step";

  const { DomainExpiryEmail } = await import("@/emails/domain-expiry");
  const { createNotification, updateNotificationResendId } = await import(
    "@/lib/db/repos/notifications"
  );
  const { generateIdempotencyKey } = await import("@/lib/notification-utils");
  const { sendPrettyEmail } = await import("@/lib/resend");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "domain-expiry-workflow" });
  const {
    trackedDomainId,
    domainName,
    userId,
    userName,
    userEmail,
    expirationDate,
    daysRemaining,
    registrar,
    notificationType,
    shouldSendEmail,
    shouldSendInApp,
  } = params;

  const idempotencyKey = generateIdempotencyKey(
    trackedDomainId,
    notificationType,
  );

  const title = `${domainName} expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const subject = `${daysRemaining <= 7 ? "⚠️ " : ""}${title}`;
  const message = `Your domain ${domainName} will expire on ${format(expirationDate, "MMMM d, yyyy")}${registrar ? ` (registered with ${registrar})` : ""}.`;

  const channels: string[] = [];
  if (shouldSendEmail) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  try {
    // Create notification record (logs the event and handles in-app display)
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
          react: DomainExpiryEmail({
            userName: userName.split(" ")[0] || "there",
            domainName,
            expirationDate: format(expirationDate, "MMMM d, yyyy"),
            daysRemaining,
            registrar,
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
      "Error sending expiry notification",
    );
    throw err;
  }
}
