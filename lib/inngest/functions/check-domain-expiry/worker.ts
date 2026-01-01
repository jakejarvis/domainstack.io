import "server-only";

import { differenceInDays, format } from "date-fns";
import type { Logger } from "inngest";
import { DomainExpiryEmail } from "@/emails/domain-expiry";
import {
  clearDomainExpiryNotifications,
  createNotification,
  hasRecentNotification,
  type NotificationType,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { getTrackedDomainForNotification } from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import {
  generateIdempotencyKey,
  getDomainExpiryNotificationType,
} from "@/lib/notification-utils";
import { sendPrettyEmail } from "@/lib/resend";

export const checkDomainExpiryWorker = inngest.createFunction(
  {
    id: "check-domain-expiry-worker",
    retries: 3,
    concurrency: {
      limit: 5,
    },
  },
  { event: INNGEST_EVENTS.CHECK_DOMAIN_EXPIRY },
  async ({ event, step, logger: inngestLogger }) => {
    const { trackedDomainId } = event.data;

    const domain = await step.run("fetch-domain", async () => {
      return await getTrackedDomainForNotification(trackedDomainId);
    });

    if (!domain) {
      inngestLogger.warn("Domain not found, skipping", { trackedDomainId });
      return { skipped: true, reason: "not_found" };
    }

    if (!domain.expirationDate) {
      return { skipped: true, reason: "no_expiration_date" };
    }

    // Ensure date object
    const expirationDate = new Date(domain.expirationDate);
    const daysRemaining = differenceInDays(expirationDate, new Date());
    const MAX_THRESHOLD_DAYS = 30;

    // Detect renewal: If expiration is now beyond our notification window,
    // clear previous notifications so they can be re-sent when approaching expiry again.
    // Note: In rare cases of temporary data issues, this may clear notifications prematurely,
    // but they will be re-sent when the domain approaches the next threshold (30d, 14d, 7d, 1d).
    if (daysRemaining > MAX_THRESHOLD_DAYS) {
      inngestLogger.debug("Domain renewed or expiration extended", {
        trackedDomainId,
        domainName: domain.domainName,
        daysRemaining,
        expirationDate: expirationDate.toISOString(),
      });

      const cleared = await step.run("clear-renewed", async () => {
        return await clearDomainExpiryNotifications(trackedDomainId);
      });

      return { renewed: true, clearedCount: cleared };
    }

    const notificationType = getDomainExpiryNotificationType(daysRemaining);
    if (!notificationType) {
      return { skipped: true, reason: "no_threshold_met" };
    }

    // Check preferences
    const { shouldSendEmail, shouldSendInApp } = await step.run(
      "check-prefs",
      async () => {
        const globalPrefs = await getOrCreateUserNotificationPreferences(
          domain.userId,
        );

        // Check for domain-specific override
        const override = domain.notificationOverrides.domainExpiry;
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
      },
    );

    if (!shouldSendEmail && !shouldSendInApp) {
      return { skipped: true, reason: "notifications_disabled" };
    }

    const alreadySent = await step.run("check-sent", async () => {
      return await hasRecentNotification(trackedDomainId, notificationType);
    });

    if (alreadySent) {
      return { skipped: true, reason: "already_sent" };
    }

    const sent = await step.run("send-email", async () => {
      return await sendExpiryNotification(
        {
          trackedDomainId,
          domainName: domain.domainName,
          userId: domain.userId,
          userName: domain.userName,
          userEmail: domain.userEmail,
          expirationDate,
          daysRemaining,
          registrar: domain.registrar ?? undefined,
          notificationType,
          shouldSendEmail,
          shouldSendInApp,
        },
        inngestLogger,
      );
    });

    return { sent };
  },
);

async function sendExpiryNotification(
  {
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
  }: {
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
  },
  logger: Logger,
): Promise<boolean> {
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
      logger.error("Failed to create notification record", {
        trackedDomainId,
        notificationType,
        domainName,
      });
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
    logger.error("Error sending expiry notification", err, {
      domainName,
      userId,
      idempotencyKey,
    });
    throw err;
  }
}
